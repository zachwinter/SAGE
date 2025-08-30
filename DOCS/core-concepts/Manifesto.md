# The SAGE Manifesto

### The Problem

Complex systems are hard. It's difficult to build them and even harder to understand them. This is true for both humans and machines.

Culturally, we have accepted this. We've allowed the difficulty to seep into our bones, affecting our very relationship with the systems we create. Software teams grow accustomed to onboarding processes that take weeks of exposure. Individual engineers are forced to provide their AI tools with small novels' worth of context before trusting them with a single change. We treat the symptom—complexity—without addressing the cause: a lack of shared, verifiable understanding.

### The Solution

When we reason about a project, we aren't mentally replaying thousands of lines of code. We're navigating a mental map of architectural patterns, data flows, and design principles. We think in relationships, not text.

SAGE's solution is to make that mental model explicit, durable, and queryable. It represents the semantically meaningful essence of a codebase as a **Code Graph**. Thousands of lines of code are distilled into their core relationships:

```cypher
(:Project)-[:HAS_ENTRYPOINT]->(:SourceFile)
(:SourceFile)-[:IMPORTS]->(:CodeEntity)
(:SourceFile)-[:EXPORTS]->(:CodeEntity)
(:SourceFile)-[:DEFINES]->(:CodeEntity)
(:SourceFile)-[:CALLS]->(:CodeEntity)
(:CodeEntity)-[:CALLS]->(:CodeEntity)
(:CodeEntity)-[:CONTAINS]->(:CodeEntity)
```

This graph is more than just a database; it is the **Ground Truth**. It becomes the shared, verifiable reality—the [Gnosis](../principles/Gnosis.md)—upon which the entire society of agents reasons.

This is the key that unlocks the living codebase. The **Guardian** uses this map to defend its territory. The **Archivist** uses it to preserve history. The **Sage** uses it to chart new courses. By grounding both human and AI cognition in this single source of truth, SAGE transforms an opaque, complex system into a transparent, living ecology you can finally have a conversation with.

---

## The Archetypes

The SAGE ecology is composed of six core archetypes, each with a distinct role, scope, and purpose. They are the specialized minds and spirits that collectively form the consciousness of your project.

- **[The Sage](../archetypes/Sage.md):** The Mind of the System
- **[The Guardian](../archetypes/Guardian.md):** The Soul of the Code
- **[The Librarian](../archetypes/Librarian.md):** The Custodian of Data
- **[The Warden](../archetypes/Warden.md):** The Shield of the Realm
- **[The Delegator](../archetypes/Delegator.md):** The Hands of the Plan
- **[The Archivist](../archetypes/Archivist.md):** The Memory of the Land

---

## 🧭 Next Steps

Now that you understand the vision behind SAGE, deepen your knowledge with:

1. **[Core Principles](./Principles.md)** — Learn the constitutional rules that govern the society
2. **[Lexicon](./Lexicon.md)** — Master the shared vocabulary and key concepts  
3. **[Archetype Deep Dive](../archetypes/)** — Explore each specialized agent in detail

Ready to see the vision in action? Check the **[Project Status](../../README.md#-project-status)** to understand current development progress and how you can contribute to bringing this vision to life.