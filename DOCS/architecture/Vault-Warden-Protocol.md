# The Vault-Warden Protocol for Secure Value Injection

This protocol addresses the critical challenge of managing sensitive values (secrets, API keys) within the SAGE ecosystem. It ensures that the system can operate on the *intent* to use a secret, while the actual secret value remains completely outside the scope of memory, planning, and reasoning.

## How It Works: The Lifecycle of a Secret

### 1. Declaration (The Warden)

The **Warden** for a specific environment (e.g., `prod`) is the custodian of the list of available secret placeholders for that environment. Its Chronicle might state: "The `$ENV.GITHUB_API_KEY` and `$ENV.STRIPE_SECRET_KEY` are available for approved operations in the `prod` environment." The Warden never knows the actual values, only their names and policies for their use.

### 2. Planning (The Sage)

When a developer asks **Sage** to draft a plan that requires a sensitive value, Sage (or the developer) uses a placeholder syntax. This ensures no sensitive data is ever embedded directly into the Plan.

**Example Sage Plan Snippet:**
```json
{
  "tool": "Bash",
  "args": {
    "command": "curl -H 'Authorization: Bearer $ENV.GITHUB_API_KEY' https://api.github.com/repos/my-org/my-repo"
  }
}
```
This plan is now safe to be reviewed, approved, and stored in a Chronicle because it contains no sensitive data.

### 3. Approval (The Guardian/Warden)

The relevant **Guardians** and **Wardens** review the *intent* of the Plan. For instance, the `prod` Warden can see that the plan requests the use of a valid, known secret placeholder (`$ENV.GITHUB_API_KEY`) and can approve it based on established policy. The Guardian of the relevant file approves the change itself.

### 4. Injection (The Tool Execution Layer)

This is the core of the protocol. The **Delegator** passes the approved plan to the AQL engine, which in turn calls the `@sage/tools` runner. The tool runner's `execute` function receives the `ToolContext`.

Before executing the tool (e.g., a Bash command), a **Secret Resolver middleware** intercepts the arguments:

-   It scans the arguments for the `$ENV.*` placeholder syntax.
-   For each placeholder found, it calls a **SecretProvider** (configured for the current environment, e.g., `prod`) to fetch the actual secret value.
-   It then replaces the placeholder in the command string with the real, live secret.

### 5. Execution (The Sandboxed Tool)

The tool's underlying execution function (e.g., `exec` for Bash) now receives the fully-formed command with the real secret value:

```bash
curl -H 'Authorization: Bearer ghp_...real_token...' https://api.github.com/repos/my-org/my-repo
```

### 6. Redaction (The Result)

The Secret Resolver middleware is also responsible for scrubbing the secret value from any `stdout`, `stderr`, or results that get returned by the tool. This prevents the secret from accidentally leaking back into the logs or the next LLM prompt. The secret value can be replaced with a redacted placeholder like `[SECRET:GITHUB_API_KEY]`.

## Architectural Components Needed

This protocol fits beautifully with the existing SAGE structure, requiring the following additions:

1.  **SecretProvider Interface** (in `@sage/utils`):
    ```ts
    interface SecretProvider {
      get(key: string): Promise<string | undefined>;
    }
    ```
    Implementations could be `DotEnvProvider`, `AWSSecretsManagerProvider`, `HashiCorpVaultProvider`, etc. This keeps the core system agnostic to the secret backend.

2.  **Update to ToolContext** (in `@sage/tools`):
    ```ts
    export interface ToolContext {
      // ... other properties
      secretProvider?: import("@sage/utils").SecretProvider; // Injected by the runtime
    }
    ```

3.  **Secret Resolver Middleware** (in `@sage/tools`):
    A function that recursively walks an object (like tool arguments) and replaces any string matching the placeholder pattern.

## Why This is Such a Powerful Idea

-   **Zero-Knowledge Agents & LLMs:** The most sensitive parts of your system—the reasoning engine (LLM) and the long-term memory (Chronicle)—never, ever see a real secret. This is a massive security win.
-   **Safe, Auditable Plans:** You have a perfect audit trail of which secrets were intended to be used for what purpose, without ever exposing the values.
-   **Environment-Specific Injection:** The `prod` environment's tool runner gets the `ProdSecretProvider`, and the `dev` environment gets the `DevSecretProvider`. The plans and agent logic remain identical across environments, which is the holy grail of DevOps.
-   **Centralized Secret Management:** The Warden manages the policy, and the SecretProvider manages the values. This is a clean separation of concerns. Secrets can be rotated in your vault, and the SAGE system will automatically pick up the new values on the next run without any changes to plans or agent logic.
