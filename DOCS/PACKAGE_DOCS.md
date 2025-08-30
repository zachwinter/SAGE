# 📦 Package Documentation Update Instructions

This document provides focused instructions for updating individual package READMEs to conform to the new SAGE documentation standards.

## 🎯 Task Overview

**Objective:** Refactor each package's README.md to follow the standardized template in `DOCS/PACKAGE_README_TEMPLATE.md`

**Success Criteria:**
- Concise, scannable README with clear Quick Start section
- Proper ecosystem context (dependencies/dependents)
- Copy-pasteable code examples that actually work
- Consistent structure across all packages

## 📋 Standard Template Structure

Every package README must follow this exact structure:

```markdown
# @sage/[package-name]

> [One-line tagline describing the package's purpose]

## Overview
[2-3 sentences explaining what this package does and why it exists]

## Installation
```bash
pnpm add @sage/[package-name]
```

## Quick Start
```typescript
import { [MainExport] } from '@sage/[package-name]';

// Minimal, copy-pasteable example demonstrating primary use case
const example = new [MainExport]();
await example.[primaryMethod]();
```

## Core API
### [PrimaryClass]
[Brief description with key method signatures]

## Role in the SAGE Ecosystem
### Dependencies
- **[@sage/dep](../dep/README.md)** — Why this package depends on it

### Dependents  
- **[@sage/dependent](../dependent/README.md)** — How it uses this package

## Development Status
![Status Badge](https://img.shields.io/badge/Status-[Status]-[color])

## Development
[Standard pnpm commands]

## Contract
This package implements the **[Package Contract](./CONTRACT.md)** [if it exists]
```

## 🔍 Package Analysis Checklist

Before updating each package, analyze:

### 1. **Core Purpose**
- [ ] What is the single most important thing this package does?
- [ ] Why does it exist in the SAGE ecosystem?
- [ ] What problem does it solve?

### 2. **Main Exports**
- [ ] What is the primary class/function users interact with?
- [ ] What's the most common usage pattern?
- [ ] What imports would a new user need?

### 3. **Dependencies & Dependents**
- [ ] Which @sage packages does this depend on? (check package.json)
- [ ] Which @sage packages depend on this? (search codebase)
- [ ] Why are these relationships important?

### 4. **Development Status**
- [ ] Is this package stable/production-ready?
- [ ] Is it under active development?
- [ ] Are there known limitations or planned changes?

## 📦 Individual Package Instructions

### packages/agents
**Priority: HIGH** - Core package
- **Purpose:** Implements the six archetypes (Sage, Guardian, Librarian, etc.)
- **Key Export:** Individual archetype classes
- **Quick Start:** Show how to instantiate and use a basic agent
- **Dependencies:** graph, chronicle, llm, tools
- **Status:** Production Ready

### packages/graph  
**Priority: HIGH** - Core package
- **Purpose:** Code knowledge representation and querying
- **Key Export:** Graph client/query interface
- **Quick Start:** Basic code analysis query
- **Dependencies:** None (foundational)
- **Status:** Production Ready

### packages/llm
**Priority: HIGH** - Core package
- **Purpose:** Multi-provider AI interface (OpenAI, Anthropic, etc.)
- **Key Export:** LLM client with provider abstraction
- **Quick Start:** Simple chat completion example
- **Dependencies:** mcp (optional)
- **Status:** Production Ready

### packages/chronicle
**Priority: HIGH** - Core package
- **Purpose:** Immutable event history and state management
- **Key Export:** Chronicle client for event logging
- **Quick Start:** Append and query events
- **Dependencies:** utils
- **Status:** Production Ready

### packages/aql
**Priority: MEDIUM** - Query language
- **Purpose:** Agent Query Language for orchestration
- **Key Export:** AQL parser/executor
- **Quick Start:** Parse and execute simple AQL
- **Dependencies:** graph, agents
- **Status:** Active Development

### packages/mcp
**Priority: HIGH** - Protocol implementation
- **Purpose:** Model Context Protocol for LLM tool integration
- **Key Export:** MCP server/client
- **Quick Start:** Basic MCP server setup
- **Dependencies:** None
- **Status:** Production Ready

### packages/tools
**Priority: MEDIUM** - Utilities
- **Purpose:** Sandboxed operations (Read, Write, Edit, Bash)
- **Key Export:** Tool registry and individual tools
- **Quick Start:** Execute a safe file operation
- **Dependencies:** utils
- **Status:** Production Ready

### packages/ui
**Priority: LOW** - UI components
- **Purpose:** Shared React/Ink components for CLI
- **Key Export:** React component exports
- **Quick Start:** Use a component in CLI app
- **Dependencies:** React, Ink
- **Status:** Active Development

### packages/test-utils
**Priority: MEDIUM** - Testing
- **Purpose:** Testing infrastructure with mocks and harnesses
- **Key Export:** Test utilities and matchers
- **Quick Start:** Set up a test with temp workspace
- **Dependencies:** vitest, utils
- **Status:** Production Ready

### packages/utils
**Priority: LOW** - Foundation
- **Purpose:** Core utilities, types, and helpers
- **Key Export:** Utility functions and types
- **Quick Start:** Use core utility functions
- **Dependencies:** None (foundational)
- **Status:** Production Ready

## 🚀 Step-by-Step Process

For each package:

### Step 1: Analyze Current README
1. Read the existing README completely
2. Identify the core purpose and main exports
3. Note any good examples or explanations to preserve
4. Check package.json for actual dependencies

### Step 2: Create Quick Start Example
1. Find the simplest possible usage example
2. Ensure it's copy-pasteable and actually works
3. Use realistic imports and setup
4. Show the most common use case, not edge cases

### Step 3: Map Ecosystem Relationships
1. Check package.json dependencies for @sage/* packages
2. Search codebase for imports of this package
3. Explain WHY these relationships exist, not just WHAT they are

### Step 4: Write New README
1. Follow the template exactly
2. Use the existing good content but reorganize it
3. Be ruthlessly concise - cut anything non-essential
4. Focus on "what" and "how", less on "why" (that's in the manifesto)

### Step 5: Validate
1. Check that all links work
2. Verify the Quick Start example is accurate
3. Ensure consistent tone and formatting
4. Test that the copy-paste example actually works

## ⚠️ Common Pitfalls to Avoid

1. **TMI (Too Much Information):** Keep READMEs focused on getting started, not comprehensive API docs
2. **Broken Examples:** Always verify code examples actually work
3. **Generic Descriptions:** Be specific about this package's unique role
4. **Missing Context:** Explain WHY this package exists in SAGE's ecosystem
5. **Inconsistent Formatting:** Follow the template structure exactly

## 🎯 Success Metrics

A good package README should:
- [ ] Take <2 minutes to read and understand
- [ ] Have a working Quick Start example someone can copy-paste
- [ ] Clearly explain the package's unique role in SAGE
- [ ] Link properly to dependencies and dependents
- [ ] Follow the exact template structure

## 📝 Notes for Implementation

- **Work on one package at a time** to maintain focus
- **Test examples in a real environment** before finalizing
- **Preserve any unique, valuable content** from existing READMEs
- **Be consistent with terminology** - use the Lexicon
- **Link liberally** to other docs and packages

---

*This systematic approach ensures every package has professional, consistent documentation that helps developers understand and use SAGE effectively.*