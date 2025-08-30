import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.d.ts",
        "**/__tests__/**",
        "**/test-utils.ts"
      ]
    },
    setupFiles: ["./src/__tests__/setup.ts"]
  },
  resolve: {
    alias: {
      "@": "./src"
    }
  }
});