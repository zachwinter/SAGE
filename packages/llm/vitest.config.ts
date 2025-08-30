import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    reporters: ['default'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    setupFiles: ['src/__tests__/setup.ts'],
    // Pool options for better isolation with streaming tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false
      }
    }
  },
});