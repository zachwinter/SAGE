import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/__tests__/**/*.test.ts"],
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
