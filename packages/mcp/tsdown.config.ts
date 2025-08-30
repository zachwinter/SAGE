import alias from "@rollup/plugin-alias";
import { dirname, resolve } from "path";
import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  plugins: [
    alias({
      entries: [
        { find: "@", replacement: resolve(__dirname, "src") },
        {
          find: "@sage/graph",
          replacement: resolve(__dirname, "../../packages/graph/src")
        },
        {
          find: "@sage/utils",
          replacement: resolve(__dirname, "../../packages/utils/src")
        }
      ]
    })
  ]
});
