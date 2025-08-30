import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTempWorkspace, golden } from "../index.js";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

describe("Golden Snapshot Testing", () => {
  let snapshotDir: string;
  
  beforeEach(async () => {
    // Clean up any existing snapshots
    snapshotDir = join(process.cwd(), "__snapshots__");
    if (existsSync(snapshotDir)) {
      await rm(snapshotDir, { recursive: true });
    }
  });
  
  afterEach(async () => {
    // Clean up snapshots after each test
    if (existsSync(snapshotDir)) {
      await rm(snapshotDir, { recursive: true });
    }
  });

  describe("Workspace Snapshots", () => {
    it("creates golden snapshot for new workspace", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/App.tsx", "export const App = () => <div>Hello</div>;");
      await ws.file("package.json", '{"name": "test-app"}');
      await ws.file("README.md", "# Test App\nThis is a test.");

      // First run should create snapshot
      await golden(ws, "test-workspace");

      // Verify snapshot file was created
      const snapshotFile = join(snapshotDir, "test-workspace.golden");
      expect(existsSync(snapshotFile)).toBe(true);

      // Verify snapshot content
      const snapshotContent = await readFile(snapshotFile, "utf8");
      expect(snapshotContent).toContain("=== README.md ===");
      expect(snapshotContent).toContain("=== package.json ===");
      expect(snapshotContent).toContain("=== src/App.tsx ===");
      
      // Files should be in alphabetical order
      const lines = snapshotContent.split('\n');
      const readmeIndex = lines.findIndex(l => l.includes('=== README.md ==='));
      const packageIndex = lines.findIndex(l => l.includes('=== package.json ==='));
      const appIndex = lines.findIndex(l => l.includes('=== src/App.tsx ==='));
      
      expect(readmeIndex).toBeLessThan(packageIndex);
      expect(packageIndex).toBeLessThan(appIndex);
    });

    it("passes when workspace matches existing snapshot", async () => {
      const ws = await createTempWorkspace();
      await ws.file("test.txt", "hello world");

      // Create initial snapshot
      await golden(ws, "matching-test");

      // Create identical workspace
      const ws2 = await createTempWorkspace();
      await ws2.file("test.txt", "hello world");

      // Should pass without throwing
      await expect(golden(ws2, "matching-test")).resolves.not.toThrow();
    });

    it("fails with detailed diff when workspace content differs", async () => {
      const ws1 = await createTempWorkspace();
      await ws1.file("src/utils.ts", "export const helper = () => 'original';");
      await ws1.file("README.md", "# Original");

      // Create initial snapshot
      await golden(ws1, "diff-test");

      // Create modified workspace
      const ws2 = await createTempWorkspace();
      await ws2.file("src/utils.ts", "export const helper = () => 'modified';");
      await ws2.file("README.md", "# Modified");
      await ws2.file("new-file.txt", "this is new");

      // Should fail with detailed diff
      await expect(golden(ws2, "diff-test")).rejects.toThrow(/Golden snapshot mismatch/);
      
      try {
        await golden(ws2, "diff-test");
      } catch (error: any) {
        const message = error.message;
        expect(message).toContain("✅ Added files: new-file.txt");
        expect(message).toContain("📝 Modified files: README.md, src/utils.ts");
        expect(message).toContain("--- Expected: README.md ---");
        expect(message).toContain("+++ Actual: README.md +++");
      }
    });

    it("fails when files are removed from workspace", async () => {
      const ws1 = await createTempWorkspace();
      await ws1.file("file1.txt", "content1");
      await ws1.file("file2.txt", "content2");
      await ws1.file("file3.txt", "content3");

      // Create initial snapshot
      await golden(ws1, "removal-test");

      // Create workspace with missing files
      const ws2 = await createTempWorkspace();
      await ws2.file("file1.txt", "content1");
      // file2.txt and file3.txt are missing

      await expect(golden(ws2, "removal-test")).rejects.toThrow(/❌ Removed files: file2.txt, file3.txt/);
    });

    it("handles empty workspaces correctly", async () => {
      const ws = await createTempWorkspace();
      // No files added

      await golden(ws, "empty-workspace");

      const snapshotFile = join(snapshotDir, "empty-workspace.golden");
      const content = await readFile(snapshotFile, "utf8");
      expect(content.trim()).toBe("");
    });

    it("handles workspaces with nested directory structures", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/components/Button.tsx", "export const Button = () => <button />;");
      await ws.file("src/utils/helpers.ts", "export const help = true;");
      await ws.file("tests/Button.test.tsx", "import { Button } from '../src/components/Button';");
      await ws.file("package.json", '{"name": "nested-test"}');

      await golden(ws, "nested-structure");

      // Verify all files are captured with proper paths
      const snapshotFile = join(snapshotDir, "nested-structure.golden");
      const content = await readFile(snapshotFile, "utf8");
      
      expect(content).toContain("=== package.json ===");
      expect(content).toContain("=== src/components/Button.tsx ===");
      expect(content).toContain("=== src/utils/helpers.ts ===");
      expect(content).toContain("=== tests/Button.test.tsx ===");
    });
  });

  describe("Single File Snapshots", () => {
    it("creates snapshot for individual file", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/component.tsx", "export const Component = () => <div>Test</div>;");

      await golden(ws, "src/component.tsx");

      // Should create snapshot in workspace __snapshots__ directory
      const expectedPath = join(ws.root, "src", "__snapshots__", "component.golden");
      expect(existsSync(expectedPath)).toBe(true);

      const content = await readFile(expectedPath, "utf8");
      expect(content).toBe("export const Component = () => <div>Test</div>;");
    });

    it("passes when file content matches snapshot", async () => {
      const ws = await createTempWorkspace();
      await ws.file("test.js", "console.log('hello');");

      // Create initial snapshot
      await golden(ws, "test.js");

      // Should pass on second run
      await expect(golden(ws, "test.js")).resolves.not.toThrow();
    });

    it("fails with diff when file content differs", async () => {
      const ws = await createTempWorkspace();
      await ws.file("script.js", "const original = true;");

      // Create initial snapshot
      await golden(ws, "script.js");

      // Modify the same file
      await ws.file("script.js", "const modified = false;");

      await expect(golden(ws, "script.js")).rejects.toThrow(/Golden snapshot mismatch/);
      
      try {
        await golden(ws, "script.js");
      } catch (error: any) {
        expect(error.message).toContain("--- Expected ---");
        expect(error.message).toContain("+++ Actual +++");
        expect(error.message).toContain("const original = true;");
        expect(error.message).toContain("const modified = false;");
      }
    });
  });

  describe("Snapshot File Management", () => {
    it("creates __snapshots__ directory if it doesn't exist", async () => {
      const ws = await createTempWorkspace();
      await ws.file("test.txt", "content");

      // Ensure no snapshots directory exists
      expect(existsSync(snapshotDir)).toBe(false);

      await golden(ws, "auto-create-dir");

      // Should have created the directory
      expect(existsSync(snapshotDir)).toBe(true);
      expect(existsSync(join(snapshotDir, "auto-create-dir.golden"))).toBe(true);
    });

    it("provides helpful console output when creating snapshots", async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const ws = await createTempWorkspace();
      await ws.file("new.txt", "new content");

      await golden(ws, "console-test");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/📸 Created golden snapshot:.*console-test\.golden/)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases", () => {
    it("handles files with special characters in names", async () => {
      const ws = await createTempWorkspace();
      await ws.file("file-with-dashes.ts", "export const test = 'special';");
      await ws.file("file.with.dots.js", "console.log('dots');");
      await ws.file("file_with_underscores.py", "print('underscores')");

      await golden(ws, "special-chars");

      const snapshotFile = join(snapshotDir, "special-chars.golden");
      const content = await readFile(snapshotFile, "utf8");
      
      expect(content).toContain("=== file-with-dashes.ts ===");
      expect(content).toContain("=== file.with.dots.js ===");
      expect(content).toContain("=== file_with_underscores.py ===");
    });

    it("handles files with empty content", async () => {
      const ws = await createTempWorkspace();
      await ws.file("empty.txt", "");
      await ws.file("also-empty.js", "");

      await golden(ws, "empty-files");

      // Should pass on second run
      await expect(golden(ws, "empty-files")).resolves.not.toThrow();
    });

    it("handles very large file content", async () => {
      const ws = await createTempWorkspace();
      const largeContent = "a".repeat(100000); // 100KB of 'a' characters
      await ws.file("large.txt", largeContent);

      await golden(ws, "large-file");

      // Should handle large files without issues
      await expect(golden(ws, "large-file")).resolves.not.toThrow();
    });
  });

  describe("Deterministic Output", () => {
    it("produces identical snapshots for same workspace created differently", async () => {
      // Create workspace with files added in one order
      const ws1 = await createTempWorkspace();
      await ws1.file("z-last.txt", "last");
      await ws1.file("a-first.txt", "first");  
      await ws1.file("m-middle.txt", "middle");

      await golden(ws1, "order-test-1");

      // Create workspace with files added in different order
      const ws2 = await createTempWorkspace();
      await ws2.file("a-first.txt", "first");
      await ws2.file("m-middle.txt", "middle");
      await ws2.file("z-last.txt", "last");

      await golden(ws2, "order-test-2");

      // Both snapshots should be identical (alphabetically ordered)
      const snapshot1 = await readFile(join(snapshotDir, "order-test-1.golden"), "utf8");
      const snapshot2 = await readFile(join(snapshotDir, "order-test-2.golden"), "utf8");
      
      expect(snapshot1).toBe(snapshot2);
    });
  });
});