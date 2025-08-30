import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    reporters: ['default'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});