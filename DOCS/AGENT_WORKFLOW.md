# 🤖 Agent Workflow for Package Documentation Updates

This document provides step-by-step instructions for agents working on package documentation updates using the TODO.md system.

## 🎯 Workflow Overview

**Story-Driven Development:** Each package update follows a structured process from analysis to user story creation to implementation.

## 📋 Step-by-Step Process

### Step 1: Package Assignment
**Input:** You will be assigned a specific package (e.g., `@sage/agents`)
**Action:** Navigate to `packages/[package-name]/TODO.md`

### Step 2: Read Required Documents
**MUST READ IN THIS ORDER:**
1. **`packages/[package-name]/TODO.md`** — Your specific assignment and context
2. **`DOCS/Package-Standards.md`** — Understanding SAGE documentation conventions  
3. **`packages/[package-name]/README.md`** — The current documentation to be updated
4. **`DOCS/PACKAGE_README_TEMPLATE.md`** — The target structure to achieve

### Step 3: Analysis Phase
After reading all documents, analyze:

#### Current State Assessment
- What are the strengths of the existing README?
- What content should be preserved?
- What are the specific problems/gaps?
- How well does it serve different user types?

#### Template Gap Analysis  
- Which template sections are missing?
- Which sections exist but need restructuring?
- What new content needs to be created?
- Are there any package-specific considerations?

### Step 4: Write User Stories
Create user stories following this exact format:

```markdown
## User Stories for @sage/[package-name] README Update

### Story 1: [Descriptive Title]
**As a** [specific user type - new developer/package maintainer/agent developer]  
**I want** [specific change to the README]  
**So that** [specific benefit I gain]  

**Acceptance Criteria:**
- [ ] [Specific, testable requirement 1]
- [ ] [Specific, testable requirement 2] 
- [ ] [Specific, testable requirement 3]

**Implementation Notes:**
- [Technical details, constraints, or special considerations]
- [Content to preserve from existing README]
- [Specific examples or code snippets needed]

### Story 2: [Next Title]
[Continue with same format...]
```

#### User Story Guidelines

**User Types to Consider:**
- **New Developer:** First-time SAGE user trying to understand what this package does
- **Package Consumer:** Developer who wants to use this package in their project  
- **SAGE Contributor:** Developer working on other SAGE packages who needs to understand dependencies
- **Agent Developer:** Advanced user building custom agents or workflows

**Story Requirements:**
- **Be Specific:** "I want a clearer Quick Start" is too vague. "I want a copy-pasteable Quick Start example showing basic agent instantiation" is good.
- **Be Testable:** Acceptance criteria must be checkable (has example, follows template, links work, etc.)
- **Be User-Focused:** Focus on what users need, not what the current README lacks

### Step 5: Wait for Approval
**DO NOT IMPLEMENT YET**
- Present your user stories for review
- Get feedback on priorities and approach
- Clarify any questions about requirements

### Step 6: Implementation (After Approval)
Once user stories are approved:

#### Implementation Order
1. **Structure First:** Create the template skeleton
2. **Quick Start:** Write the copy-pasteable example
3. **Core Content:** Fill in Overview, Core API, Ecosystem sections  
4. **Polish:** Add proper links, formatting, status badges

#### Quality Checklist
- [ ] Follows template structure exactly
- [ ] Quick Start example is copy-pasteable and works
- [ ] All links are functional (test them)
- [ ] Uses consistent terminology from Lexicon
- [ ] Is scannable (clear headers, bullets, short paragraphs)
- [ ] Meets all acceptance criteria from user stories

### Step 7: Final Validation
Before marking complete:
- [ ] README follows template exactly
- [ ] All user story acceptance criteria met
- [ ] Links tested and functional
- [ ] Quick Start example verified
- [ ] Consistent with other updated packages

## 🚨 Critical Guidelines

### DO:
- **Read everything first** before writing stories
- **Be specific** in user stories and acceptance criteria
- **Preserve valuable existing content** while reorganizing
- **Test all examples** and links
- **Use consistent terminology** from the Lexicon
- **Focus on user needs** not internal implementation

### DON'T:
- **Start implementing** before getting story approval
- **Copy generic content** - each package is unique
- **Add unnecessary complexity** - keep it scannable
- **Break existing links** without creating redirects
- **Ignore the ecosystem context** - explain relationships

## 🎯 Success Metrics

A successful package README update:
- Takes a new developer <2 minutes to understand the package's purpose
- Has a working Quick Start they can copy-paste immediately  
- Clearly explains the package's role in the SAGE ecosystem
- Follows the template structure exactly
- Uses consistent terminology and linking patterns

## 📝 Example User Story

```markdown
### Story 1: Clear Package Purpose for New Developers
**As a** new SAGE developer exploring the ecosystem  
**I want** a concise, jargon-free explanation of what @sage/agents does  
**So that** I can quickly understand if this package is relevant to my needs  

**Acceptance Criteria:**
- [ ] Overview section explains the package purpose in 2-3 sentences
- [ ] Uses plain language, avoiding excessive technical jargon
- [ ] Mentions the six archetypes (Sage, Guardian, etc.) as key concept
- [ ] Connects to the broader SAGE philosophy without being verbose
- [ ] Includes the "Society of Minds" tagline appropriately

**Implementation Notes:**
- Preserve the existing archetype explanations but make them more concise
- Reference the Lexicon for technical terms
- Focus on "what" and "how" rather than "why" (philosophy is in manifesto)
```

## 🔄 Iteration Process

If changes are requested:
1. Update the relevant user stories
2. Adjust acceptance criteria as needed  
3. Re-implement affected sections
4. Revalidate against all criteria

---

*This systematic approach ensures every package gets professional, consistent documentation that truly serves SAGE users.*