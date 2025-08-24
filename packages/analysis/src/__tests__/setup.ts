import { vi } from "vitest";
import path from 'path';

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

// This ensures that any child process spawned by Vitest can find the project's node_modules.
process.env.NODE_PATH = path.resolve(process.cwd(), 'node_modules');

