import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  
  outDir: "dist"
});
