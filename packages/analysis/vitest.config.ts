import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    env: {
      NODE_PATH: path.resolve(__dirname, "./node_modules")
    },
    include: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "**/node_modules/**",
      "dist/**",
      "**/dist/**",
      "**/*.d.ts"
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    retry: process.env.CI ? 2 : 0
  },
  define: {
    'import.meta.vitest': undefined,
  },
  optimizeDeps: {
    exclude: ['kuzu']
  },
  ssr: {
    noExternal: ['kuzu']
  }
});