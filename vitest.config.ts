import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    watch: false,
    reporters: ["default"],
    globals: true,
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    // This sets the NODE_PATH environment variable for all test processes,
    // ensuring that spawned scripts can find your project's node_modules.
    env: {
      NODE_PATH: path.resolve(__dirname, "./node_modules")
    },
    include: ["src/**/*.test.{ts,tsx}", "__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      "**/node_modules/**",
      "dist/**",
      "**/dist/**",
      "**/*.d.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "json-summary"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.config.js",
        "__tests__/**",
        "src/__tests__/**",
        "src/**/__tests__/**",
        "src/**/*.test.ts",
        "src/**/*.spec.ts"
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    retry: process.env.CI ? 2 : 0,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false
      }
    }
  }
});
