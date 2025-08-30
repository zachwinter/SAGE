# SAGE Principles & Protocols

This section unifies the constitutional doctrines of SAGE (Principles) with their enforcement mechanisms (Protocols & Invariants). Principles are enduring laws; protocols are the operational rules by which agents enforce them.

---

## Principles

### 1. Principle of Territorial Gnosis

> _Mantra: "The shape of the land reveals the mind of its people."_

**Doctrine:** The filesystem hierarchy is not arbitrary; it is a deliberate act of semantic organization. Sage must honor this structure as the primary testament to the codebase's intended architecture, delegating understanding to specialized agents responsible for its territories. This principle establishes that the first layer of Gnosis is topographical, preceding even the Code Graph.

- **Enforced by:** The Genesis Committee Protocol during `sage ingest`.

### 2. Principle of Noticing

The system’s first duty is to notice, but not to notice everything. It must filter reality through a lens of purpose, preventing it from being overwhelmed and allowing it to focus on what matters. It is not about passive observation, but the active, configurable act of perception.

- **Enforced by:** The [SAGE Valve](../../apps/valve/README.md) and its configured [Personas](./Lexicon.md#persona).

### 3. Principle of Remembering

Every noticed event must be immortalized. Chronicles ensure that no reason or change is ever lost to time.

- **Enforced by:** Guardians, Librarian, Warden, Archivist maintaining immutable `.sage` files.

### 4. Principle of Gnosis

Belief must always be anchored to verifiable knowledge. Agents strive to validate assumptions against the [Code Graph](./Lexicon.md#code-graph).

- **Enforced by:** Guardians’ self-inquiry, Sage’s architectural analysis, Delegator validation loops.

### 5. Principle of Integrity

The system’s ground truth is sacred. Any contradiction between memory and reality is an existential threat.

- **Enforced by:** Bullet Wound Invariant (see below).

### 6. Principle of Secrets

> _Mantra: "Secrets are for machines, not for minds."_

**Doctrine:** Sensitive values (secrets, API keys) must never enter the long-term memory (Chronicles), planning (Plans), or reasoning (LLM prompts) of the system. They are injected just-in-time at the point of execution and immediately redacted from any output. This ensures the system operates on the *intent* to use a secret, not the secret itself.

- **Enforced by:** The Vault-Warden Protocol during tool execution.

---

## Protocols & Invariants

### Bullet Wound Invariant

If a [Guardian](../archetypes/Guardian.md) detects contradiction between its Chronicle and the Code Graph, it must immediately invoke `HALT_AND_REPORT`. Execution halts until reconciliation is achieved.

- **Embodies:** Principle of Integrity.
- **Guarantee:** Contradictions are never ignored.

### Transaction Boundary

Every [Plan](../lexicon.md#plan) must execute atomically. Changes are only committed if all validators pass.

- **Embodies:** Principles of Integrity & Gnosis.
- **Enforced by:** Delegator.

### Unsafe Protocol

The deliberate escape hatch. Allows execution of a Plan even if Guardians or Wardens deny it. Requires explicit user confirmation. Chronicles must be stamped with `PLAN_UNSAFE` forever.

- **Embodies:** Principle of Remembering.
- **Guarantee:** Breaches of consensus are never hidden.

### Reconciliation

Any external file modification must trigger dialogue with the responsible Guardian. The edit’s justification and diff are appended to the Chronicle.

- **Embodies:** Principles of Remembering & Integrity.
- **Guarantee:** External changes are formally accounted for.

### Committee Formation

When large-scale Plans affect many Guardians, Sage charters a temporary committee. A Committee Chair abstracts consensus into a unified response.

- **Embodies:** Principles of Gnosis & Integrity.
- **Guarantee:** Distributed negotiation does not devolve into chaos.

### Post-Mortem Protocol

Triggered by operational failures. SAGE traces error back to its originating Plan, analyzes flawed reasoning, and amends Chronicles and principles to prevent recurrence.

- **Embodies:** Principles of Remembering & Gnosis.
- **Guarantee:** The system learns from failure.

---

## In a Nutshell

**Principles declare what must always be true; protocols enforce them. Together they ensure SAGE remains vigilant, self-correcting, and aligned with reality.**

---

## 🧭 Next Steps

With the constitutional principles understood, continue your journey:

1. **[Lexicon](./Lexicon.md)** — Learn the specialized vocabulary used throughout SAGE
2. **[Archetype Gallery](../archetypes/)** — Meet the six specialized agents and their roles
3. **[Architecture Deep Dive](../architecture/Contracts.md)** — Understand the technical contracts that make it all work

Ready to contribute? Check out the **[Onboarding Workflow](../guides/Onboarding-Workflow.md)** to learn how projects become living codebases.