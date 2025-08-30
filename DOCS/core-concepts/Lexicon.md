# SAGE Lexicon

The official glossary of the SAGE Framework. It defines the core concepts, agents, and protocols that form the shared language of the SAGE ecology.

---

### A

- **AQL (Agent/Action Query Language)**
  A declarative, GraphQL-inspired language for orchestrating LLM/tool/agent workflows.
  Compiles to an execution plan that streams via ` @sage/llm` and invokes capabilities
  from ` @sage/tools`. Used to express multi-step, multi-agent operations concisely
  and type-safely. See `packages/aql/README.md`.

- **Archivist**
  The project’s historiographer. One of the six canonical [Personas](#persona), it records the history of the codebase’s physical terrain—the lifecycle of its files and directories. Its [Chronicle](#chronicle) is the definitive record of lineage.

### B

- **Bullet Wound Invariant**
  Enforcement of the [Principle of Integrity](#principle-of-integrity). If a [Guardian](#guardian) detects contradiction between its Chronicle and the [Code Graph](#code-graph), it must invoke `HALT_AND_REPORT`, freezing execution until reconciliation.

### C

- **Chronicle**
  The immutable `.sage` file that serves as append-only memory for an agent (Guardian, Warden, Librarian, Archivist). Chronicles capture irreducible units of change—diffs, justifications, and metadata—not verbose chat logs. They embody the [Principle of Remembering](#principle-of-remembering).

- **Code Graph**
  The structural ground truth of the system. Stored in Kùzu, it represents the objective AST-derived reality of the codebase. All agent beliefs are validated against it, embodying the [Principle of Gnosis](#principle-of-gnosis).

- **Committee Formation**
  Protocol for managing large-scale Plans. When a [Plan](#plan) impacts many [Guardians](#guardian), [Sage](#sage) charters a temporary committee and appoints a Chair to consolidate negotiation into a unified response.

- **Commit-Addressable Graph**
  Core feature of the Code Graph: all nodes and edges are versioned by commit index, enabling time-travel queries and exact historical reconstructions.

- **Consciousness-Driven Development**
  The new development paradigm enabled by the [SAGE Valve](#sage-valve). Instead of developers manually watching for changes and running tools, they declaratively define [Personas](#persona) that watch the codebase and trigger actions automatically. This elevates development from a series of manual tasks to the act of composing and directing automated consciousnesses.

### D

- **Delegator**
  The compiler and transaction manager for approved Plans. The Delegator converts a Plan into an [AQL](#aql-agentaction-query-language) query and ensures its atomic execution under a [Transaction Boundary](#transaction-boundary). It does not design workflows, it enforces them. Its hands are only translators: Plans are written in AQL, not TypeScript.

### G

- **Genesis Committee Protocol**
  The mechanism that enforces the [Principle of Territorial Gnosis](#principle-of-territorial-gnosis) during the `sage ingest` process. Sage first performs a topographical survey of the filesystem, then charters a committee of specialized agents to understand the purpose and structure of significant territories (directories) in parallel, using clustering and chain-of-command strategies to manage complexity.

- **Genesis Thread**
  The foundational architectural analysis produced by the [Genesis Committee Protocol](#genesis-committee-protocol) at `sage ingest`. It is a structured report from a society of agents, not a single analysis, that forms the first entry in the project's main Chronicle, giving all future agents their shared origin context.

- **Gnosis**
  Verifiable knowledge: the state achieved when beliefs are validated against an authoritative source, such as the filesystem structure ([Territorial Gnosis](#principle-of-territorial-gnosis)) or the [Code Graph](#code-graph). Opposite of assumption or hallucination.

- **Guardian**
  The soul of the code. One of the six canonical [Personas](#persona), it is a long-lived agent custodian of a single file. Maintains its Chronicle, defends architectural principles, and enforces the [Bullet Wound Invariant](#bullet-wound-invariant) when integrity is threatened.

### I

- **Infra Chronicle**
  Specialized Chronicle maintained by a [Warden](#warden). Logs builds, deployments, and environment events.

- **Ingest**
  Process of performing a physical scan of the codebase (`sage ingest`) to populate the Code Graph.

### L

- **Librarian**
  The custodian of data models. One of the six canonical [Personas](#persona), it is a project-level agent responsible for database schemas, ORM models, and API contracts. Ensures coherence across all data layers.

- **Living Codebase**
  The philosophy of SAGE: a codebase is not static text but a living society of collaborating, stateful agents.

### P

- **Persona**
  A specialized, declarative consciousness pattern within the [SAGE Valve](#sage-valve). Defined in a `valve.yml` file, a Persona specifies a set of file patterns (filters) and content patterns (triggers) that cause the Valve to notice a change and emit a `VALVE_PERSONA_TRIGGER` event. The six canonical Personas are [Guardian](#guardian), [Warden](#warden), [Librarian](#librarian), [Archivist](#archivist), and [Sage](#sage).

- **Plan**
  The formal proposal for change. Drafted by [Sage](#sage), reviewed by Guardians and Wardens, and executed by the [Delegator](#delegator).

- **Principle of Gnosis**
  Doctrine: anchor all beliefs to verifiable knowledge in the Code Graph.

- **Principle of Integrity**
  Doctrine: contradictions between memory and reality are existential threats.

- **Principle of Noticing**
  Doctrine: the system must be configured to perceive all relevant events. It's not about passively observing everything, but actively filtering reality through a lens of purpose, preventing the system from being overwhelmed and allowing it to focus on what matters.

- **Principle of Remembering**
  Doctrine: every noticed event must be preserved in a Chronicle.

- **Post-Mortem Protocol**
  Learning loop triggered by failure. SAGE correlates errors to their Plans, analyzes flaws, and amends Chronicles and principles to prevent recurrence.

### R

- **Reconciliation**
  The primary protocol for handling events generated by the [SAGE Valve](#sage-valve). When a [Persona](#persona) is triggered, a [Guardian](#guardian) may initiate Reconciliation to engage the developer, justify the change, and formally record the outcome in its [Chronicle](#chronicle).

### S

- **SAGE Valve**
  The system's configurable sensory apparatus, inspired by Aldous Huxley's "perceptual valve." It is an always-on process that watches the filesystem, but instead of treating all changes equally, it filters them through a set of configured [Personas](#persona). It is the tangible "nervous system" that makes the codebase truly "living."

- **Sage**
  The mind of the system. One of the six canonical [Personas](#persona), it is the creative partner that engages the developer, drafts Plans, mediates negotiation, and passes approved Plans to the Delegator.

- **SecretProvider**
  An interface (defined in `@sage/utils`) that abstracts access to external secret stores (e.g., AWS Secrets Manager, HashiCorp Vault). It allows the Vault-Warden Protocol to fetch secret values just-in-time without the core SAGE system needing to know the backend implementation.

### T

- **Territorial Gnosis**
  The first layer of [Gnosis](#gnosis), derived from the filesystem hierarchy itself. It is the understanding that a project's directory structure is a deliberate act of semantic organization that reveals the codebase's intended architecture. See [Principle of Territorial Gnosis](./Principles.md#1-principle-of-territorial-gnosis).

- **Transaction Boundary**
  Safety protocol ensuring Plans execute atomically. No changes are committed unless all validators succeed.

### U

- **Unsafe Protocol**
  Escape hatch allowing execution of denied Plans with explicit user override. Stamps Chronicles permanently with `PLAN_UNSAFE`.

### V

- **Vault-Warden Protocol**
  A security protocol for secrets management. It ensures that sensitive values (secrets, API keys) are never stored in Chronicles, Plans, or LLM prompts. Instead, they are injected just-in-time at the tool execution layer and immediately redacted from any output. This allows the system to operate on the _intent_ to use a secret, not the secret itself. See [Principle of Secrets](../principles/Secrets.md).

### W

- **Warden**
  The shield of the realm. One of the six canonical [Personas](#persona), it is the guardian of operational environments (dev, staging, prod). Custodian of infra/config files, deployments, and environment policies.

---

## In a Nutshell

**The Lexicon ensures all agents speak a common language of principles, artifacts, and roles, binding the SAGE ecology into a coherent society.**
