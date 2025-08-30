import { setupHelpers } from "@sage/test-utils";

// Setup deterministic environment for graph tests
setupHelpers.setupDeterministicEnv();

// Clean up any test artifacts before and after tests
beforeEach(async () => {
  await setupHelpers.cleanup();
});

afterAll(async () => {
  await setupHelpers.cleanup();
});

// Set global test timeout for graph operations
vi.setConfig({ testTimeout: 30000 });
