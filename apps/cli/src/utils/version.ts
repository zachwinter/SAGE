import { readFileSync } from "fs";

export function getVersion() {
  const packagePath = new URL("../package.json", import.meta.url);

  try {
    const packageContent = JSON.parse(readFileSync(packagePath, "utf8"));
    return packageContent.version;
  } catch (error) {
    return "unknown version";
  }
}
