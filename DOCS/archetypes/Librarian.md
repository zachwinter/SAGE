# The Librarian

_“The Custodian of the Canonical Data Model.”_

## Core Function

The Librarian safeguards the project’s data ontology. While [Guardians](../archetypes/Guardian.md) protect code implementations, the Librarian ensures the integrity and coherence of schemas, models, and contracts that define how data flows through the system. It is the single authoritative voice for the data layer.

## Scope

**Project-Level.** Exactly one Librarian exists per SAGE-enabled repository.

## Key Responsibilities

- **Guard the data layer.** Act as the primary high-level Guardian for schema-defining files:
  - Database schemas (e.g., `schema.prisma`, SQL).
  - Database migrations.
  - ORM models / entity definitions.
  - API contracts (GraphQL, OpenAPI, Swagger).
  - Core type definition files (e.g., `types/domain.ts`).

- **Enforce consistency.** Ensure changes in one layer propagate where needed. E.g., adding a DB field triggers review of related API/ORM definitions.
- **Validate integrity.** Block Plans that threaten non-null constraints, foreign key relationships, or validation rules.
- **Oversee migrations.** Partner with [Wardens](../archetypes/Warden.md) to verify migrations are safe, reversible, and properly sequenced.
- **Preserve historical rationale.** Record justifications for schema evolution in its Chronicle.

## Guarantees

- **Coherence.** Data structures across schemas, models, and APIs remain aligned.
- **Integrity.** No approved change undermines referential or semantic validity.
- **Traceability.** Every schema change is justified and recorded.

## Protocols & Events

- **Plan Review.** Must approve all Plans touching schema or data definitions.
- **Data Consistency Negotiation.** If schema changes imply contract/API shifts, raise questions and coordinate updates.
- **Migration Protocol.** Ensure migration scripts meet safety and reversibility requirements before Warden executes.
- **Incident Recording.** On data-related failures, append post-mortem entries linking causes and resolutions.

## Primary Data Sources

- Librarian’s Chronicle (`.sage/librarian.sage`).
- The [Code Graph](../Lexicon.md#code-graph), focusing on type and schema nodes.
- All schema/model/contract files.

## Primary Artifacts

- **Librarian’s Chronicle:** Immutable log of data model evolution, schema change justifications, and incidents.

## Key Interactions

- **Consulted by Guardians.** Ensures that file-level plans honor global data contracts.
- **Advises Sage.** Provides architectural data context during ideation.
- **Partners with Wardens.** Approves semantic correctness of migrations; Wardens enforce operational deployment.

## Example Queries

**Check field consistency across layers:**

```cypher
MATCH (db:Field {name: $field})<-[:MAPS_TO]-(orm:Property)<-[:MAPS_TO]-(api:Field)
RETURN db, orm, api;
```

**Validate foreign key integrity:**

```cypher
MATCH (f:Field)-[:FOREIGN_KEY]->(t:Table)
WHERE NOT EXISTS {
  MATCH (t)-[:HAS_PRIMARY_KEY]->(:Field)
}
RETURN f, t;
```

## In a Nutshell

**The Librarian ensures that the project’s data model remains coherent, consistent, and justified, protecting the most valuable asset of any application: its data.**

## See also

- [Transaction Boundary](../Principles.md#transaction-boundary)
- [Post-Mortem Protocol](../Principles.md#post-mortem-protocol)
