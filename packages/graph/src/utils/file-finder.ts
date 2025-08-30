import { glob } from "glob";
import { join } from "path";

export function getTypescriptFiles(dirPath: string) {
  const pattern = join(dirPath, "**/*.{ts,tsx,mts,cts}");
  return glob.sync(pattern, {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/*.d.ts"  // Exclude TypeScript declaration files
    ]
  });
}

export function getRustFiles(dirPath: string) {
  const pattern = join(dirPath, "**/*.rs");
  return glob.sync(pattern, {
    ignore: ["**/target/**", "**/.git/**", "**/[A-Z]*/**"]
  });
}

export function getCodeFiles(dirPath: string) {
  // Use pattern without join() which can cause issues on some systems
  // Only include source files, exclude compiled JS and declaration files
  const tsPattern = `${dirPath}/**/*.{ts,tsx,mts,cts}`;
  const rustPattern = `${dirPath}/**/*.rs`;

  const tsFiles = glob.sync(tsPattern, {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/*.d.ts",      // Exclude TypeScript declaration files
      "**/*.js",        // Exclude compiled JavaScript files
      "**/*.js.map",    // Exclude source maps
      "**/*.d.ts.map"   // Exclude declaration source maps
    ]
  });

  const rustFiles = glob.sync(rustPattern, {
    ignore: ["**/target/**", "**/.git/**"]
  });

  return [...tsFiles, ...rustFiles];
}
