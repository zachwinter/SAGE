import { defineConfig } from "tsup";
import { resolve } from "path";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  alias: {
    "@": resolve(__dirname, "src")
  },
  outDir: "dist"
});
