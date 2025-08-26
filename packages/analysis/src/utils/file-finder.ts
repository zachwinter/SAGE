import { glob } from "glob";
import { join } from "path";

export function getTypescriptFiles(dirPath: string) {
  const pattern = join(dirPath, "**/*.{ts,tsx,js,jsx,mts,cts}");
  return glob.sync(pattern, {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**"
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
  const tsPattern = `${dirPath}/**/*.{js,jsx,ts,tsx,mts,cts}`;
  const rustPattern = `${dirPath}/**/*.rs`;

  const tsFiles = glob.sync(tsPattern, {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**"
    ]
  });

  const rustFiles = glob.sync(rustPattern, {
    ignore: ["**/target/**", "**/.git/**"]
  });

  return [...tsFiles, ...rustFiles];
}
