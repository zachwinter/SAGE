# Package Documentation Update TODO

**Agent Instructions:** Read this entire TODO, then read the current `README.md` file completely. After understanding both, write user stories for the changes needed.

## 📋 Task Overview

**Package:** `@sage/agents`  
**Priority:** HIGH  
**Current Status:** Good content but needs standardization and clearer Quick Start

## 🎯 Objective

Transform this package's README.md to follow the **[standardized template](../../DOCS/PACKAGE_README_TEMPLATE.md)** while preserving valuable existing content and ensuring accuracy.

## 📚 Required Reading

**MUST READ FIRST:**
1. **[Package Standards](../../DOCS/Package-Standards.md)** — Understanding SAGE documentation conventions
2. **[Current README.md](./README.md)** — The existing documentation to be updated
3. **[Template](../../DOCS/PACKAGE_README_TEMPLATE.md)** — The target structure to achieve

## 🔍 Package Analysis

### Core Purpose
**What this package does:** Implements the core logic and state machines for SAGE's six archetypal agents (Sage, Guardian, Librarian, Warden, Delegator, Archivist)

### Key Exports  
**Main classes/functions:** Individual archetype implementations (SageAgent, GuardianAgent, etc.)

### Dependencies
**@sage packages this depends on:**
- **@sage/graph** — For querying code relationships and structure
- **@sage/chronicle** — For event logging and state persistence
- **@sage/llm** — For natural language reasoning capabilities
- **@sage/tools** — For executing safe operations on code
- **@sage/utils** — For shared utilities and error handling

### Dependents
**@sage packages that depend on this:**
- **@sage/aql** — Uses agents for query execution and orchestration
- **CLI applications** — Instantiate and coordinate agents for user interactions

### Current Issues
**Problems with existing README:**
- Missing standardized template structure
- No clear, copy-pasteable Quick Start example
- Complex explanation that could be simplified
- Missing proper ecosystem dependency explanations
- No development status indicator

## ✅ Success Criteria

The updated README must:
- [x] Follow the exact template structure
- [x] Include a working, copy-pasteable Quick Start example
- [x] Clearly explain this package's unique role in SAGE
- [x] Have accurate dependency/dependent relationships
- [x] Be scannable in under 2 minutes
- [x] Use consistent terminology from the [Lexicon](../../DOCS/core-concepts/Lexicon.md)

## 🚨 Critical Requirements

### Quick Start Example
- **MUST show instantiating a basic agent** (e.g., Guardian)
- **MUST demonstrate a simple agent operation** (e.g., reviewing a plan)
- **MUST use realistic mock dependencies** (graph, chronicle, etc.)
- **MUST be under 10 lines of actual usage code**

### Ecosystem Context
- **MUST explain WHY agents need graph access** (for code understanding)
- **MUST explain WHY chronicle integration matters** (for state/memory)
- **MUST show HOW AQL uses agents** for orchestration

### Tone & Style
- **MUST cut the verbose philosophical explanations** (move to manifesto)
- **MUST focus on practical usage** over theory
- **MUST be scannable with clear headers**

## 📝 Agent Workflow

**Step 1:** Read all required documents completely
**Step 2:** Analyze the current README.md and identify specific issues
**Step 3:** Write user stories in this format:

```markdown
## User Stories for README Update

### Story 1: [Title]
**As a** [developer type]  
**I want** [specific change]  
**So that** [benefit achieved]  

**Acceptance Criteria:**
- [ ] [Specific, testable requirement 1]
- [ ] [Specific, testable requirement 2]

**Implementation Notes:**
- [Technical details or constraints]
```

**Step 4:** Wait for approval before implementing changes

## 🎯 Package-Specific Notes

- **Preserve the agent architecture explanations** but make them concise
- **The relationship with Valve is important** but should be brief
- **Focus on the six core archetypes** as the main value proposition
- **Emphasize the contract-based approach** to agent interfaces
- **Show dependency injection pattern** in the Quick Start

---

*This TODO has been completed! The README.md now follows the template exactly and all user stories have been implemented successfully.*