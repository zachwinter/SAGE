# 📦 SAGE Package Standards

This document defines the standardized structure, conventions, and practices for all SAGE packages.

## 🏗️ Standard Package Structure

Every SAGE package follows this consistent structure:

```
packages/[package-name]/
├── README.md                 # Package overview and quick start
├── CONTRACT.md              # Detailed behavioral contract
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Test configuration
├── tsdown.config.ts        # Build configuration
├── src/
│   ├── index.ts            # Main export barrel
│   ├── types.ts            # Core type definitions
│   ├── [feature]/          # Feature-specific modules
│   └── __tests__/          # Unit tests
├── docs/                   # Extended documentation
└── examples/               # Usage examples
```

## 📄 Standard README Template

Every package README must follow this template:

```markdown
# @sage/[package-name]

> [One-line tagline describing the package's purpose]

## Overview

[2-3 sentences explaining what this package does and why it exists]

## Installation

\```bash
pnpm add @sage/[package-name]
\```

## Quick Start

\```typescript
import { [MainExport] } from '@sage/[package-name]';

// Minimal, copy-pasteable example demonstrating primary use case
const example = new [MainExport]();
await example.[primaryMethod]();
\```

## Core API

### [PrimaryClass]

[Brief description of main functionality]

\```typescript
// Key method signatures with examples
\```

## Role in the SAGE Ecosystem

### Dependencies
- **[@sage/[dep1]](../[dep1]/README.md)** — [Why this package depends on dep1]
- **[@sage/[dep2]](../[dep2]/README.md)** — [Why this package depends on dep2]

### Dependents  
- **[@sage/[dependent1]](../[dependent1]/README.md)** — [How dependent1 uses this package]
- **[@sage/[dependent2]](../[dependent2]/README.md)** — [How dependent2 uses this package]

## Development Status

![Status: [Production Ready|In Development|Prototype]](https://img.shields.io/badge/Status-[Status]-[color])

[Brief description of current stability and planned changes]

## Development

\```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Run type checking
pnpm typecheck
\```

## Contract

This package implements the **[[PackageName] Contract](./CONTRACT.md)**, which defines:
- [Key behavioral guarantee 1]
- [Key behavioral guarantee 2]
- [Key behavioral guarantee 3]

See the [full contract specification](./CONTRACT.md) for detailed interface definitions and guarantees.
```

## 🏷️ Package Naming Conventions

### Package Names
- Use kebab-case: `@sage/package-name`
- Be descriptive and concise
- Avoid redundant prefixes (don't use `sage-` prefix)

### Directory Structure
- Use kebab-case for directories: `feature-name/`
- Group related functionality together
- Keep nesting shallow (max 3 levels)

### File Names
- Use kebab-case for files: `file-name.ts`
- Use descriptive names: `user-manager.ts` not `um.ts`
- Test files: `file-name.test.ts`
- Type definition files: `types.ts` or `file-name.types.ts`

## 🔧 Configuration Standards

### package.json
Required fields and scripts:

```json
{
  "name": "@sage/package-name",
  "version": "0.1.0",
  "description": "Brief package description",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["sage", "relevant", "keywords"],
  "repository": "https://github.com/sage-ai/sage",
  "license": "MIT"
}
```

### TypeScript Configuration
Extend the base configuration:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

### Test Configuration
Use the standardized Vitest setup:

```typescript
import { vitestConfigs } from "@sage/test-utils";

export default vitestConfigs.[packageType](); // e.g., graph(), agents(), etc.
```

## 📋 Contract Requirements

Every package must include a `CONTRACT.md` file with:

### Behavioral Contracts
- **Purpose Statement:** What problem this package solves
- **Interface Definition:** Public API with input/output specifications  
- **Behavioral Guarantees:** What callers can rely on
- **Error Handling:** How failures are communicated
- **Performance Characteristics:** Expected timing and resource usage

### Example Contract Structure
```markdown
# [Package Name] Contract

## Purpose
[1-2 sentences describing the package's role in the SAGE ecosystem]

## Interface
[Detailed API documentation with TypeScript signatures]

## Guarantees
- [Specific behavioral guarantee 1]  
- [Specific behavioral guarantee 2]
- [Specific behavioral guarantee 3]

## Error Handling
[How errors are thrown, what types, when they occur]

## Performance
[Expected performance characteristics, limits, timeouts]
```

## 🧪 Testing Standards

### Test Organization
- **Unit tests:** `src/__tests__/[module].test.ts`
- **Integration tests:** `src/__tests__/integration/[scenario].integration.test.ts`
- **Contract tests:** `src/__tests__/contract/[contract].contract.test.ts`

### Test Naming
```typescript
describe('[ClassName]', () => {
  describe('[methodName]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
    
    it('should throw [ErrorType] when [invalid condition]', () => {
      // Error case testing
    });
  });
});
```

### Testing Best Practices
- **Use descriptive test names** that explain the expected behavior
- **Test both success and failure cases** for every public method
- **Use the shared test utilities** from `@sage/test-utils`
- **Mock external dependencies** to isolate package functionality
- **Include property-based tests** for complex logic

## 🎨 Code Style Standards

### TypeScript Guidelines
- **Use strict TypeScript:** Enable all strict mode options
- **Export types explicitly:** Always export interfaces and types used by consumers
- **Use branded types:** For IDs and other domain-specific values
- **Prefer composition:** Over inheritance for flexibility

### Naming Conventions
```typescript
// Classes: PascalCase
class UserManager {}

// Functions: camelCase  
function createUser() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// Types/Interfaces: PascalCase
interface UserProfile {}
type UserId = string & { __brand: 'UserId' };

// Enums: PascalCase with PascalCase values
enum UserRole {
  Admin = 'Admin',
  Member = 'Member'
}
```

### Documentation Standards
- **JSDoc for public APIs:** All exported functions, classes, and interfaces
- **Include examples:** Show typical usage patterns
- **Document error conditions:** When and why functions might fail
- **Link to related concepts:** Reference other packages, types, or documentation

```typescript
/**
 * Creates a new user profile with validation and persistence.
 * 
 * @param userData - The user information to store
 * @returns Promise resolving to the created user ID
 * @throws {ValidationError} When userData fails validation
 * @throws {PersistenceError} When database operation fails
 * 
 * @example
 * ```typescript
 * const userId = await createUser({
 *   name: 'Alice',
 *   email: 'alice@example.com'
 * });
 * ```
 * 
 * @see {@link UserProfile} for userData structure
 * @see {@link @sage/graph} for persistence layer
 */
async function createUser(userData: UserProfile): Promise<UserId> {
  // Implementation
}
```

## 🔄 Development Workflow

### Adding New Packages
1. **Create directory:** `packages/[package-name]/`
2. **Copy template:** Use existing package as starting point
3. **Update package.json:** Set name, description, dependencies  
4. **Write CONTRACT.md:** Define behavioral contract
5. **Implement functionality:** Follow coding standards
6. **Add tests:** Include unit, integration, and contract tests
7. **Update documentation:** README, JSDoc, examples
8. **Add to workspace:** Update root `pnpm-workspace.yaml`

### Modifying Existing Packages
1. **Check contract:** Ensure changes don't break existing guarantees
2. **Update tests first:** Write tests for new functionality
3. **Implement changes:** Follow established patterns
4. **Update documentation:** Keep README and CONTRACT.md current
5. **Run full test suite:** Ensure no regressions
6. **Update dependents:** If interface changes affect other packages

## 🚀 Release Guidelines

### Version Management
- **Follow SemVer:** Major.Minor.Patch versioning
- **Coordinate releases:** Use changesets for monorepo releases
- **Update changelogs:** Document breaking changes and new features

### Pre-release Checklist
- [ ] All tests pass
- [ ] Type checking passes  
- [ ] Contract tests verify behavioral guarantees
- [ ] Documentation is up-to-date
- [ ] Examples work with new version
- [ ] Breaking changes are documented
- [ ] Migration guide exists (if needed)

---

*These standards ensure consistency across all SAGE packages, making the system easier to understand, maintain, and extend. When every package follows the same conventions, developers can quickly orient themselves and contribute effectively to any part of the system.*