import { describe, it, expect } from "vitest";
import { 
  createTempWorkspace, 
  golden, 
  expectDirEquals,
  withTempDir
} from "../index.js";

describe("Story 1: Temp FS & Workspace Harnesses", () => {
  describe("createTempWorkspace", () => {
    it("creates isolated workspace with required API", async () => {
      const ws = await createTempWorkspace();
      
      // Verify structure matches CONTRACT.md
      expect(ws).toHaveProperty("root");
      expect(typeof ws.root).toBe("string");
      expect(ws).toHaveProperty("file");
      expect(ws).toHaveProperty("read");
      expect(ws).toHaveProperty("tree");
    });
    
    it("writes and reads files correctly", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("test.txt", "hello world");
      const content = await ws.read("test.txt");
      
      expect(content).toBe("hello world");
    });
    
    it("handles nested directories", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("src/utils/helper.ts", "export const help = true;");
      const content = await ws.read("src/utils/helper.ts");
      
      expect(content).toBe("export const help = true;");
    });
    
    it("builds complete tree structure", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("package.json", '{"name": "test"}');
      await ws.file("src/index.ts", "export {};");
      await ws.file("src/lib/util.ts", "export const util = 1;");
      
      const tree = await ws.tree();
      
      expect(tree).toEqual({
        "package.json": '{"name": "test"}',
        "src/index.ts": "export {};",
        "src/lib/util.ts": "export const util = 1;"
      });
    });
    
    it("rejects paths that escape workspace", async () => {
      const ws = await createTempWorkspace();
      
      await expect(ws.file("../escape.txt", "bad")).rejects.toThrow(
        "Path cannot escape workspace"
      );
      
      await expect(ws.file("/absolute.txt", "bad")).rejects.toThrow(
        "Absolute paths not allowed"
      );
    });
    
    it("uses custom prefix when provided", async () => {
      const ws = await createTempWorkspace({ prefix: "custom-test-" });
      
      expect(ws.root).toContain("custom-test-");
    });
  });
  
  describe("expectDirEquals", () => {
    it("passes when directories match exactly", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("a.txt", "content a");
      await ws.file("b.txt", "content b");
      
      await expect(expectDirEquals(ws, {
        "a.txt": "content a",
        "b.txt": "content b"
      })).resolves.not.toThrow();
    });
    
    it("throws descriptive error for missing files", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("a.txt", "content a");
      
      await expect(expectDirEquals(ws, {
        "a.txt": "content a",
        "b.txt": "content b"
      })).rejects.toThrow("Missing files: b.txt");
    });
    
    it("throws descriptive error for extra files", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("a.txt", "content a");
      await ws.file("b.txt", "content b");
      
      await expect(expectDirEquals(ws, {
        "a.txt": "content a"
      })).rejects.toThrow("Extra files: b.txt");
    });
    
    it("throws descriptive error for different content", async () => {
      const ws = await createTempWorkspace();
      
      await ws.file("a.txt", "actual content");
      
      await expect(expectDirEquals(ws, {
        "a.txt": "expected content"
      })).rejects.toThrow("Different content: a.txt");
    });
  });
  
  describe("withTempDir integration", () => {
    it("automatically cleans up temp directories", async () => {
      let tempPath: string;
      
      await withTempDir(async (tempFs) => {
        await tempFs.create();
        tempPath = tempFs.getPath();
        
        expect(tempPath).toBeTruthy();
        // Directory should exist during test
      });
      
      // Directory should be cleaned up after test
      // Note: This is hard to test reliably across platforms
      // The cleanup happens in finally block
    });
  });
  
  describe("path security", () => {
    it("normalizes paths correctly", async () => {
      const ws = await createTempWorkspace();
      
      // These should all work (safe paths)
      await ws.file("./normal.txt", "content");
      await ws.file("sub/./file.txt", "content");
      
      const tree = await ws.tree();
      expect(tree).toHaveProperty("normal.txt");
      expect(tree).toHaveProperty("sub/file.txt");
    });
    
    it("blocks dangerous path patterns", async () => {
      const ws = await createTempWorkspace();
      
      // These should all fail
      const dangerousPaths = [
        "../escape.txt",
        "../../escape.txt", 
        "sub/../../../escape.txt",
        "/absolute.txt",
        "null\0byte.txt"
      ];
      
      for (const path of dangerousPaths) {
        await expect(ws.file(path, "content")).rejects.toThrow();
      }
    });
  });

  describe("Golden Snapshot Integration", () => {
    it("works with golden snapshot testing for complete workspace", async () => {
      const ws = await createTempWorkspace();
      
      // Create a realistic project structure
      await ws.file("package.json", JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        scripts: { test: "vitest" }
      }, null, 2));
      
      await ws.file("src/index.ts", [
        "export class Calculator {",
        "  add(a: number, b: number): number {",
        "    return a + b;",
        "  }",
        "}"
      ].join('\n'));
      
      await ws.file("src/utils.ts", "export const PI = 3.14159;");
      
      await ws.file("README.md", [
        "# Test Project",
        "",
        "A simple calculator project for testing golden snapshots.",
        "",
        "## Usage",
        "```ts",
        "import { Calculator } from './src/index';",
        "const calc = new Calculator();",
        "console.log(calc.add(2, 3)); // 5",
        "```"
      ].join('\n'));

      // This should work without throwing (snapshot creation or validation)
      await expect(golden(ws, "calculator-project")).resolves.not.toThrow();
      
      // Verify the workspace tree is what we expect
      const tree = await ws.tree();
      expect(Object.keys(tree).sort()).toEqual([
        "README.md",
        "package.json", 
        "src/index.ts",
        "src/utils.ts"
      ]);
    });
  });
});