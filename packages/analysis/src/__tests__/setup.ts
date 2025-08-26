import { vi } from "vitest";
import path from 'path';

// Don't mock console - we need to see debug output!

// Mock process.env for tests
process.env.NODE_ENV = "test";

// This ensures that any child process spawned by Vitest can find the project's node_modules.
process.env.NODE_PATH = path.resolve(process.cwd(), 'node_modules');

// Note: Removed Kuzu mocks since we're now using Rust binary integration
// Integration tests now use the actual Rust kuzu-rust binary for ingestion

