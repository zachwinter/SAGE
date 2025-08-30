# Story 1: Temp FS & Workspace Harnesses

## Goal
Implement isolated filesystem testing utilities with auto-cleanup and golden snapshot support.

## Acceptance Criteria
From CONTRACT.md `@sage/test-utils` section:
- [ ] `createTempWorkspace()` with isolated filesystem per test
- [ ] Path guards preventing writes outside workspace
- [ ] Pretty diff rendering for file/directory comparison
- [ ] Golden snapshot testing with `golden()` function
- [ ] Auto-cleanup integration with test lifecycle

## Implementation Plan

### Phase 1: Temp Workspace Creation
- Create `src/temp-fs.ts` with workspace management
- Generate unique temp directories with configurable prefix
- Provide workspace object with file manipulation helpers
- Ensure proper cleanup on test completion

### Phase 2: File Operations API
- `workspace.file(path, content)` for creating files
- `workspace.read(path)` for reading file contents
- `workspace.tree()` for getting complete directory structure
- Path validation and normalization utilities

### Phase 3: Path Guards & Security
- Prevent writes outside workspace boundaries
- Validate all paths against workspace root
- Proper error handling for security violations
- Cross-platform path handling (Windows/Unix)

### Phase 4: Directory Comparison & Diffing
- `expectDirEquals(workspace, expectedStructure)` matcher
- Pretty-printed diffs for directory structure mismatches
- File content comparison with unified diff output
- Handle binary files and large files gracefully

### Phase 5: Golden Snapshot Testing
- `golden(workspace, path)` saves/compares against snapshots
- Store snapshots in `__snapshots__/` directory next to tests
- Automatic snapshot creation in record mode
- Deterministic snapshot content (sorted keys, stable timestamps)

### Phase 6: Test Framework Integration
- Vitest/Jest integration with proper lifecycle hooks
- Automatic cleanup on test completion (success or failure)
- Concurrent test isolation (unique temp dirs)
- Memory leak prevention and resource cleanup

## Dependencies
- Node.js `fs`, `path`, `os` modules for filesystem operations
- Test framework hooks (Vitest/Jest)
- `@sage/utils` for deterministic operations

## Estimated Effort
**4-5 hours** - Filesystem operations with proper cleanup are tricky.

## Success Metrics
- Tests run in complete isolation without cross-contamination
- No temp files left behind after test completion
- Golden snapshots provide clear diff output on failures
- Works reliably across platforms (macOS, Linux, Windows)
- Performance acceptable for hundreds of concurrent tests