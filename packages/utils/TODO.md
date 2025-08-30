# Package Documentation Update TODO

**Agent Instructions:** Read this entire TODO, then read the current `README.md` file completely. After understanding both, write user stories for the changes needed.

## 📋 Task Overview

**Package:** `@sage/utils`  
**Priority:** LOW  
**Current Status:** Foundational package needs template standardization and clearer utility showcase

## 🎯 Objective

Transform this package's README.md to follow the **[standardized template](../../DOCS/PACKAGE_README_TEMPLATE.md)** while preserving valuable existing content and ensuring accuracy.

## 📚 Required Reading

**MUST READ FIRST:**
1. **[Package Standards](../../DOCS/Package-Standards.md)** — Understanding SAGE documentation conventions
2. **[Current README.md](./README.md)** — The existing documentation to be updated
3. **[Template](../../DOCS/PACKAGE_README_TEMPLATE.md)** — The target structure to achieve

## 🔍 Package Analysis

### Core Purpose
**What this package does:** Provides foundational utilities, types, error handling, and helpers used across all SAGE packages

### Key Exports  
**Main classes/functions:** Core types, error classes, utility functions, canonicalization, directory helpers

### Dependencies
**@sage packages this depends on:**
- **None** — This is the foundational package

### Dependents
**@sage packages that depend on this:**
- **All packages** — Every SAGE package depends on @sage/utils for core functionality
- **Package developers** — Anyone building on SAGE uses these foundational utilities

### Current Issues
**Problems with existing README:**
- Missing standardized template structure
- Needs clearer showcase of key utilities
- Generic "utils" concept needs better explanation
- Missing explanation of foundational role
- No clear examples of most useful utilities

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
- **MUST show most commonly used utilities** (error handling, types)
- **MUST demonstrate practical usage patterns**
- **MUST be relevant to package developers**
- **MUST showcase the foundational nature**

### Ecosystem Context
- **MUST explain WHY foundational utilities matter**
- **MUST show HOW all packages depend on this**
- **MUST clarify the "Foundation" concept**

### Tone & Style
- **MUST emphasize foundational role** in ecosystem
- **MUST be developer-focused** 
- **MUST show practical utility** over comprehensive listing

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

## 📋 Stories

### ✅ Completed
- [x] **[Story 1: Standardize README Structure](./STORY-1-standardize-readme.md)** — Refactor README to follow the standardized template
- [x] **Story 2: Create Contract Documentation** — Create a CONTRACT.md file that defines the behavioral guarantees and interface specifications

### 🔜 Future
- [ ] **Story 3: Enhance Examples** — Add more comprehensive examples to the Quick Start section

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

## 🎯 Package-Specific Notes

- **"Foundation" is the key concept** - explain what this means
- **Show most useful utilities** rather than comprehensive listing
- **Emphasize the dependency tree** - everything builds on this
- **Include error handling patterns** as key feature
- **Show type definitions** that enable other packages
- **Keep it practical** - focus on what developers actually use

---

*This TODO will be marked complete when the README.md follows the template exactly and all user stories are implemented successfully.*