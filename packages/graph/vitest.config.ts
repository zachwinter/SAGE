import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Graph operations can be slower
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    // Retry flaky tests for I/O operations
    retry: 2,
    // Pool options for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Graph tests can interfere with each other
      },
    },
  },
});