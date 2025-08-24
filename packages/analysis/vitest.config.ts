import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'kuzu': path.resolve(__dirname, './node_modules/kuzu/index.js'),
    },
  },
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
      "**/*.d.ts",
      "src/graph/**", // Temporarily exclude graph tests
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    retry: process.env.CI ? 2 : 0,
    deps: {
      optimizer: {
        ssr: {
          exclude: ['kuzu']
        }
      }
    },
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