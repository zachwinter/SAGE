# @sage/aql TODO

Transform this package's README.md to follow the **[standardized template](../../DOCS/PACKAGE_README_TEMPLATE.md)** while preserving valuable existing content and ensuring accuracy.

## 📋 Stories

### ✅ Completed
- [x] **[Story 1: Standardize README Structure](./STORY-1-standardize-readme.md)** — Refactor README to follow the standardized template
- [x] **[Story 2: Clarify Package Purpose and Value](./STORY-2-clarify-purpose.md)** — Clearly explain what AQL does and why it exists
- [x] **[Story 3: Provide Working Quick Start Example](./STORY-3-quick-start.md)** — Add a clear, copy-pasteable Quick Start example
- [x] **[Story 4: Document Core API](./STORY-4-core-api.md)** — Document the main `AQL` class and its methods
- [x] **[Story 5: Map Ecosystem Relationships](./STORY-5-ecosystem.md)** — Show how AQL relates to other packages
- [x] **[Story 6: Document Development Status and Workflow](./STORY-6-development.md)** — Clearly indicate prototype status and show standard commands

### 🔜 In Progress
- [ ] **[Parser Enhancement](./docs/roadmap.md#parser-enhancement)** — Replace the current `SimpleAQLParser` with a robust, grammar-based parser
- [ ] **[Delegator as AQL Translator](./docs/roadmap.md#delegator-as-aql-translator)** — Refactor the `@sage/agents` **Delegator** to function as a pure translator of a `Plan` into an AQL query

### 🚀 Future
- [ ] **Tool Integration** — Connect the AQL `tool()` operation to the `@sage/tools` registry
- [ ] **Chronicle Integration** — Instrument the AQL execution engine to emit events to `@sage/chronicle`
- [ ] **Full SAGE Integration** — Complete integration with the SAGE ecosystem for real agent and tool executions

## 📄 Standard README Template

Every package README must follow this template:

1. **Package Name** — `# @sage/[package-name]`
2. **Tagline** — `> [One-line tagline describing the package's purpose]`
3. **Overview** — [2-3 sentences explaining what this package does and why it exists within the SAGE ecosystem]
4. **Installation** — Standard installation instructions
5. **Quick Start** — Minimal, copy-pasteable example demonstrating primary use case
6. **Core API** — Key classes and methods with examples
7. **Role in the SAGE Ecosystem** — Dependencies and dependents with explanations
8. **Development Status** — Current stability with appropriate badge
9. **Development** — Standard development commands
10. **Contract** — Link to contract specification
11. **Footer** — Standard SAGE footer

*This TODO will be marked complete when the README.md follows the template exactly and all user stories are implemented successfully.*