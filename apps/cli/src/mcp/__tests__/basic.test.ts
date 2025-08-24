import { describe, it, expect } from "vitest";

describe("Basic Tests", () => {
  it("should verify test setup is working", () => {
    expect(1 + 1).toBe(2);
  });

  it("should test basic string operations", () => {
    const githubUrl = "https://github.com/user/repo-name.git";
    const match = githubUrl.match(
      /github\.com\/[^\/]+\/([^\/]+?)(?:\.git)?(?:\/)?$/
    );
    const repoName = match?.[1] || "unknown";
    expect(repoName.replace(".git", "")).toBe("repo-name");
  });
});
