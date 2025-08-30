# Principle of Secrets

> _Mantra: "Secrets are for machines, not for minds."_

**Doctrine:** Sensitive values (secrets, API keys) must never enter the long-term memory (Chronicles), planning (Plans), or reasoning (LLM prompts) of the system. They are injected just-in-time at the point of execution and immediately redacted from any output. This ensures the system operates on the *intent* to use a secret, not the secret itself.

- **Enforced by:** The Vault-Warden Protocol during tool execution.