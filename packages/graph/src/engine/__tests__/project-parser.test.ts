import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTempWorkspace } from "@sage/test-utils";
import { parseProjectInfo, findPackages } from "../project-parser.js";

describe("project-parser", () => {
  it("should parse pnpm monorepo correctly", async () => {
    const workspace = await createTempWorkspace({ prefix: "sage-project-test-" });
    
    // Create a pnpm monorepo structure
    await workspace.file(
      "package.json",
      JSON.stringify({
        name: "test-monorepo",
        version: "1.0.0",
        pnpm: {
          workspaces: [
            "apps/*",
            "packages/*"
          ]
        }
      }, null, 2)
    );
    
    // Create app and package directories with package.json files
    await workspace.file(
      "apps/cli/package.json",
      JSON.stringify({
        name: "@test/cli",
        version: "1.0.0",
        main: "dist/index.js"
      }, null, 2)
    );
    
    await workspace.file(
      "packages/utils/package.json",
      JSON.stringify({
        name: "@test/utils",
        version: "1.0.0",
        main: "dist/index.js"
      }, null, 2)
    );
    
    // Parse project info
    const projectInfo = parseProjectInfo(workspace.root);
    
    expect(projectInfo).not.toBeNull();
    expect(projectInfo?.isMonorepo).toBe(true);
    expect(projectInfo?.workspaces).toEqual(["apps/*", "packages/*"]);
    
    if (projectInfo) {
      const packages = findPackages(projectInfo, workspace.root);
      expect(packages).toHaveLength(2);
      expect(packages.map(p => p.name)).toContain("@test/cli");
      expect(packages.map(p => p.name)).toContain("@test/utils");
    }
  });
});