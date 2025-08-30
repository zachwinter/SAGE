# SAGE Valve Implementation

This package contains the **Rust implementation** of the SAGE Valve, the perceptual apparatus for the SAGE framework.

For a complete conceptual overview of the SAGE Valve, its philosophy, and its role in the SAGE ecosystem, please see the primary documentation:

**➡️ [Main Documentation: The SAGE Valve](../../DOCS/Valve.md)**

---

## Development & Testing

This document provides practical guidance for developers working on the Rust application.

### Testing Tips and Gotchas

Here's a comprehensive guide to testing in the SAGE Valve project, covering the challenges we've encountered and how to avoid them.

#### 1. Configuration File Testing

**Challenge**: The `ValveConfig::load_from_repo` function expects the configuration file to be located at `.sage/valve.yml` relative to the repository root.

**Solution**: Always create the `.sage` directory and place the configuration file within it:

```rust
let temp_dir = TempDir::new().expect("Failed to create temp directory");
let sage_dir = temp_dir.path().join(".sage");
std::fs::create_dir_all(&sage_dir).expect("Failed to create .sage directory");
let config_file = sage_dir.join("valve.yml");
fs::write(&config_file, config_str).expect("Failed to write config file");
```

**Footgun**: Forgetting to create the `.sage` subdirectory will result in a "missing config" error.

#### 2. Path Canonicalization Issues

**Challenge**: The `Registry::add` method canonicalizes paths using `canonicalize()`, which can lead to path comparison issues in tests.

**Solution**: Always compare canonicalized paths with canonicalized paths:

```rust
assert_eq!(codebase.path, test_path.canonicalize().unwrap());
```

**Footgun**: Comparing a canonicalized path with a non-canonicalized path will fail even if they refer to the same location.

#### 3. Directory Creation Before Adding to Registry

**Challenge**: The `Registry::add` method requires the path to exist and be canonicalizable.

**Solution**: Always create directories before adding them to the registry:

```rust
let test_path = temp_dir.path().join("test_project");
std::fs::create_dir_all(&test_path).expect("Failed to create test directory");
let codebase = registry.add(&test_path).expect("Failed to add codebase");
```

**Footgun**: Trying to add a non-existent directory will result in an "Invalid argument" error.

#### 4. UUID-based Registry Entries

**Challenge**: Each call to `Registry::add` creates a new entry with a unique UUID, even for the same path.

**Solution**: When testing removal by path, understand that it removes the first matching entry, not all entries:

```rust
// Add two codebases with the same path
let codebase1 = registry.add(&test_path).expect("Failed to add codebase");
let codebase2 = registry.add(&test_path).expect("Failed to add codebase");

// Remove by path (removes only the first match)
let removed = registry.remove_by_id_or_path(test_path.to_str().unwrap()).expect("Failed to remove codebase");
assert!(removed.is_some());

// The second entry still exists
let removed2 = registry.remove_by_id_or_path(&codebase2.id).expect("Failed to remove codebase");
assert!(removed2.is_none()); // This will fail because the entry still exists
```

**Footgun**: Assuming that adding the same path twice and then removing by path will remove both entries.

#### 5. Shared Registry Testing

**Challenge**: Testing the `SharedRegistry` requires understanding how `Arc` references work.

**Solution**: Use `std::ptr::eq` to compare `Arc` references:

```rust
let registry = Registry::load_or_default().expect("Failed to load registry");
let shared_registry = SharedRegistry::new(registry);
let shared_registry_clone = shared_registry.clone();

// Both should point to the same data
assert!(std::ptr::eq(shared_registry.0.as_ref(), shared_registry_clone.0.as_ref()));
```

**Footgun**: Trying to access fields of the `Arc` directly using dot notation (e.g., `shared_registry.0 .0`) will result in compilation errors.

#### 6. Persona Matching Tests

**Challenge**: Testing persona matching requires creating valid configuration files with proper syntax.

**Solution**: Use raw string literals for YAML configuration and ensure proper indentation:

```rust
let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.txt"]
    triggers: ["test"]
"#;
```

**Footgun**: Incorrect YAML indentation or missing newlines can cause parsing errors.

#### 7. Test Environment Isolation

**Challenge**: Tests that modify global state or filesystem locations can interfere with each other.

**Solution**: Use `tempfile::TempDir` to create isolated test environments and set environment variables as needed:

```rust
let temp_dir = TempDir::new().expect("Failed to create temp directory");
std::env::set_var("HOME", temp_dir.path());
```

**Footgun**: Tests that share the same HOME directory or registry file can interfere with each other.

#### 8. Test Cleanup

**Challenge**: Tests that create files or modify system state should clean up after themselves.

**Solution**: Use RAII patterns with `TempDir` which automatically cleans up when it goes out of scope:

```rust
#[test]
fn test_something() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    // Test code here
    // temp_dir is automatically cleaned up when it goes out of scope
}
```

**Footgun**: Manually created temporary files that aren't cleaned up can accumulate and cause test failures.

#### 9. Regex Escaping in Tests

**Challenge**: Regex patterns in configuration files need to be properly escaped when used in raw strings.

**Solution**: Use double backslashes for regex patterns in YAML:

```rust
let config_str = r#"
personas:
  TestWatcher:
    filters: ["**/*.rs"]
    triggers: ["fn\s+main"]  # Note the double backslash
"#;
```

**Footgun**: Forgetting to escape backslashes in regex patterns will result in invalid regex errors.

#### 10. Test Coverage Strategy

To ensure comprehensive test coverage:

1. **Unit Tests**: Test individual functions and methods in isolation
2. **Integration Tests**: Test how modules work together
3. **Edge Cases**: Test error conditions and boundary cases
4. **Happy Path**: Test the expected normal flow
5. **State Management**: Test how state changes over time

### Running Tests

To run all tests:

```bash
cargo test
```

To run tests with output:

```bash
cargo test -- --nocapture
```

To run a specific test:

```bash
cargo test test_name
```
