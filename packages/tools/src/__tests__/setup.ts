// Global test setup
import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// Mock process.cwd() for consistent test behavior
const mockCwd = "/tmp/test-workspace";
vi.mock("process", () => ({
  cwd: vi.fn(() => mockCwd)
}));

beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});