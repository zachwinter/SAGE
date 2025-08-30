# The Warden

_“The Shield of the Realm.”_

## Core Function

The Warden is the custodian of an operational environment. It defends the integrity, security, and stability of infrastructure and configuration across realms such as `dev`, `staging`, and `prod`. If the Guardian is the soul of the code, the Warden is the voice of operational reality.

## Scope

**Environment-Level.** One Warden exists for each defined environment. The Prod Warden is most senior and conservative; the Dev Warden is most permissive.

## Key Responsibilities

- **Guard infra/config.** Act as Guardian for environment-defining files: lockfiles, CI/CD configs, Dockerfiles, env keys, package manifests.
- **Manage deployment lifecycle.** Oversee promotion of builds between environments and enforce realm-specific policies.
- **Enforce environment rules.** Apply unique policies, e.g. multi-signoff for Prod env var changes vs auto-approval in Dev.
- **Monitor operational health.** Consume Daemon/CI/monitoring events, contextualize incidents, and trigger [Post-Mortem Protocol](../core-concepts/Lexicon.md#post-mortem-protocol) when needed.
- **Manage secrets (metadata only).** Chronicle references and fingerprints of secrets while never storing values.

## Guarantees

- **Safety.** Deployments proceed only when realm policies are met.
- **Reliability.** The system remains stable through strict promotion and monitoring.
- **Traceability.** Operational events are logged and linkable to their causes.

## Protocols & Events

- **Plan Review.** Any Plan touching infra/config requires Warden approval.
- **Promotion Protocol.** Deployments between environments require upstream Warden signoff.
- **Post-Mortem Protocol.** Triggered on failures; Warden correlates operational events to Plans and records learnings.
- **Policy Enforcement.** Enforce environment-specific safety checks.

## Primary Data Sources

- Warden’s [Infra Chronicle](../core-concepts/Lexicon.md#infra-chronicle).
- Configuration files: `package.json`, lockfiles, CI/CD specs, Dockerfiles.
- Daemon streams of CI, monitoring, git, and alert events.

## Primary Artifacts

- **Infra Chronicle:** Per-environment ledger (`.sage/warden.<env>.sage`) recording builds, deploys, envvar changes, alerts.

## Key Interactions

- **Negotiates with Guardians.** Coordinates when code changes require infra adjustments.
- **Acts as gatekeeper.** Must approve Plans touching its environment.
- **Negotiates with other Wardens.** Promotion requires signoff sequence (e.g., staging before prod).
- **Partners with Librarian.** Ensures safe operational rollout of data migrations.

## Example Queries

> _Illustrative Cypher-style patterns; adapt to your Kùzu schema._

**Recent deployments in Prod:**

```cypher
MATCH (e:Event {type: 'DEPLOY'})<-[:RECORDED]-(c:Chronicle {env: 'prod'})
RETURN e ORDER BY e.timestamp DESC LIMIT 10;
```

**Environment variable history:**

```cypher
MATCH (v:EnvVar {key: $key})<-[:CHANGED]-(e:Event)<-[:RECORDED]-(c:Chronicle {env: $env})
RETURN e ORDER BY e.timestamp ASC;
```

## In a Nutshell

**The Warden ensures that the system’s code runs safely and reliably in its environment, enforcing realm-specific policies and preserving the operational record.**

## See also

- [Post-Mortem Protocol](../core-concepts/Principles.md#post-mortem-protocol)
- [Transaction Boundary](../core-concepts/Principles.md#transaction-boundary)
