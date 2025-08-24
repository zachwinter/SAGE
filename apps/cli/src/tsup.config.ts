import { resolve } from "path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  alias: {
    "@": resolve(import.meta.dirname, "src"),
    "@sage/analysis": resolve(import.meta.dirname, "../../packages/analysis/src")
  },
  outDir: "dist"
});
