import { vi } from "vitest";
import path from 'path'; // Added import

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Mock process.env for tests
process.env.NODE_ENV = "test";

// This is the global fix for all ERR_MODULE_NOT_FOUND errors in tests.
// It ensures that any child process spawned by Vitest can find the project's node_modules.
process.env.NODE_PATH = path.resolve(process.cwd(), 'node_modules');
