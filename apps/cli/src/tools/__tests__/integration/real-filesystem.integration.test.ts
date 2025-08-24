import { analyzeFiles } from "@sage/analysis/engine/analyzer";
import { getCodeFiles } from "@sage/analysis/utils/file-finder";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Bash } from "../../Bash.js";
import { Edit } from "../../Edit.js";
import { Read } from "../../Read.js";
import { Write } from "../../Write.js";

describe("Real File System Integration Tests", () => {
  let tempProjectDir: string;
  let realProjectDir: string;

  beforeAll(() => {
    // Create a temporary project that mimics a real development environment
    tempProjectDir = join(tmpdir(), `real-fs-integration-${Date.now()}`);
    mkdirSync(tempProjectDir, { recursive: true });

    // Use the actual ink-cli project directory for some tests
    realProjectDir = resolve(process.cwd());
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempProjectDir)) {
      rmSync(tempProjectDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up temp project before each test
    if (existsSync(tempProjectDir)) {
      rmSync(tempProjectDir, { recursive: true });
    }
    mkdirSync(tempProjectDir, { recursive: true });
  });

  describe("Real Project Structure Handling", () => {
    it("should handle typical Node.js project structure", async () => {
      // Create realistic Node.js project structure
      const projectStructure = [
        "package.json",
        "tsconfig.json",
        "vitest.config.ts",
        ".gitignore",
        "README.md",
        "src/index.ts",
        "src/utils/helpers.ts",
        "src/components/Button.tsx",
        "src/components/index.ts",
        "tests/unit/helpers.test.ts",
        "tests/integration/app.test.ts",
        "dist/index.js",
        "node_modules/react/package.json",
        "node_modules/typescript/package.json",
        ".git/config",
        "docs/api.md"
      ];

      // Create all directories first
      const dirs = new Set<string>();
      for (const filePath of projectStructure) {
        const dir = join(tempProjectDir, filePath.split("/").slice(0, -1).join("/"));
        if (dir !== tempProjectDir) {
          dirs.add(dir);
        }
      }

      for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
      }

      // Create package.json
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        type: "module",
        scripts: {
          build: "tsc",
          test: "vitest",
          dev: "vite"
        },
        dependencies: {
          react: "^18.0.0",
          typescript: "^5.0.0"
        },
        devDependencies: {
          "@types/react": "^18.0.0",
          vitest: "^1.0.0"
        }
      };

      const writePkgResult = await Write.implementation({
        file_path: join(tempProjectDir, "package.json"),
        content: JSON.stringify(packageJson, null, 2)
      });
      expect(writePkgResult.success).toBe(true);

      // Create source files with realistic content
      const indexContent = `import { Button } from './components/index.js';
import { formatDate, validateEmail } from './utils/helpers.js';

export function App() {
  const handleClick = () => {
    const email = 'test@example.com';
    if (validateEmail(email)) {
      console.log('Valid email:', email);
    }
  };

  return (
    <div>
      <h1>Test App - {formatDate(new Date())}</h1>
      <Button onClick={handleClick}>Click Me</Button>
    </div>
  );
}`;

      const writeIndexResult = await Write.implementation({
        file_path: join(tempProjectDir, "src", "index.ts"),
        content: indexContent
      });
      expect(writeIndexResult.success).toBe(true);

      const helpersContent = `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}`;

      const writeHelpersResult = await Write.implementation({
        file_path: join(tempProjectDir, "src", "utils", "helpers.ts"),
        content: helpersContent
      });
      expect(writeHelpersResult.success).toBe(true);

      // Discover code files (should exclude node_modules, dist, .git)
      const codeFiles = getCodeFiles(tempProjectDir);

      expect(codeFiles.length).toBeGreaterThan(0);
      expect(codeFiles.some(f => f.includes("src/index.ts"))).toBe(true);
      expect(codeFiles.some(f => f.includes("src/utils/helpers.ts"))).toBe(true);
      expect(codeFiles.some(f => f.includes("node_modules"))).toBe(false);
      expect(codeFiles.some(f => f.includes("dist"))).toBe(false);

      // Analyze discovered files
      const analysisResults = analyzeFiles(codeFiles);
      expect(analysisResults.length).toBeGreaterThan(0);

      // Verify analysis found expected entities
      const allEntities = analysisResults.flatMap(r => r.entities);
      const entityNames = allEntities.map(e => e.name);

      expect(entityNames).toContain("App");
      expect(entityNames).toContain("formatDate");
      expect(entityNames).toContain("validateEmail");
      expect(entityNames).toContain("debounce");
    });

    it("should handle projects with complex directory structures", async () => {
      // Create complex project structure
      const baseDir = join(tempProjectDir, "complex-project");
      mkdirSync(baseDir, { recursive: true });

      // Create multiple workspaces
      const workspaces = [
        "packages/core",
        "packages/ui",
        "packages/utils",
        "apps/web",
        "apps/api"
      ];

      for (const workspace of workspaces) {
        const workspaceDir = join(baseDir, workspace);
        mkdirSync(workspaceDir, { recursive: true });
        mkdirSync(join(workspaceDir, "src"), { recursive: true });

        // Create package.json for each workspace
        const packageJson = {
          name: `@company/${workspace.split("/")[1]}`,
          version: "1.0.0",
          main: "dist/index.js",
          types: "dist/index.d.ts"
        };

        const writePkgResult = await Write.implementation({
          file_path: join(workspaceDir, "package.json"),
          content: JSON.stringify(packageJson, null, 2)
        });
        expect(writePkgResult.success).toBe(true);

        // Create source files
        const sourceContent = `// ${workspace} module
export * from './components/index.js';
export * from './utils/index.js';

export default class ${workspace.split("/")[1].charAt(0).toUpperCase() + workspace.split("/")[1].slice(1)}Module {
  constructor() {
    console.log('${workspace} module initialized');
  }
}`;

        const writeSrcResult = await Write.implementation({
          file_path: join(workspaceDir, "src", "index.ts"),
          content: sourceContent
        });
        expect(writeSrcResult.success).toBe(true);
      }

      // Create root package.json with workspaces
      const rootPackageJson = {
        name: "complex-project",
        version: "1.0.0",
        workspaces: workspaces,
        scripts: {
          build: "turbo build",
          test: "turbo test",
          lint: "turbo lint"
        }
      };

      const writeRootPkgResult = await Write.implementation({
        file_path: join(baseDir, "package.json"),
        content: JSON.stringify(rootPackageJson, null, 2)
      });
      expect(writeRootPkgResult.success).toBe(true);

      // Discover files across all workspaces
      const codeFiles = getCodeFiles(baseDir);

      expect(codeFiles.length).toBe(workspaces.length); // One index.ts per workspace

      // Verify each workspace has its file
      for (const workspace of workspaces) {
        expect(codeFiles.some(f => f.includes(`${workspace}/src/index.ts`))).toBe(
          true
        );
      }

      // Analyze all workspace files
      const analysisResults = analyzeFiles(codeFiles);
      expect(analysisResults.length).toBe(workspaces.length);

      // Each workspace should have its module class
      const allEntities = analysisResults.flatMap(r => r.entities);
      const classes = allEntities.filter(e => e.type === "class");
      expect(classes.length).toBe(workspaces.length);
    });
  });

  describe("File Permission and Access Handling", () => {
    it("should handle files with different permissions", async () => {
      const testFile = join(tempProjectDir, "permission-test.txt");
      const content = "Test content for permission test";

      // Create file with Write tool
      const writeResult = await Write.implementation({
        file_path: testFile,
        content
      });
      expect(writeResult.success).toBe(true);

      // Read file to verify creation
      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);

      // Change file permissions using Bash (Note: chmod might not have a noticeable effect on all OS, e.g., Windows)
      const bashResult = await Bash.implementation({
        command: `chmod 644 "${testFile}"`
      });
      expect(bashResult.success).toBe(true);

      // Should still be able to read
      const readAfterChmod = await Read.implementation({
        file_path: testFile
      });
      expect(readAfterChmod.success).toBe(true);
      expect(readAfterChmod.message).toBe(content);

      // Edit should still work
      const editResult = await Edit.implementation({
        file_path: testFile,
        old_string: "Test content",
        new_string: "Modified content"
      });
      expect(editResult.success).toBe(true);

      const finalRead = await Read.implementation({
        file_path: testFile
      });
      expect(finalRead.success).toBe(true);
      expect(finalRead.message).toBe("Modified content for permission test");
    });
  });

  describe("Cross-Platform File Handling", () => {
    it("should handle different path separators and file naming", async () => {
      // Create files with various naming conventions
      const testFiles = [
        "camelCase.ts",
        "PascalCase.ts",
        "kebab-case.ts",
        "snake_case.ts",
        "UPPERCASE.ts",
        "file.with.dots.ts",
        "file-with-numbers123.ts"
      ];

      for (const fileName of testFiles) {
        const content = `// ${fileName}
export const fileName = "${fileName}";
export function getFileName() {
  return fileName;
}`;

        const writeResult = await Write.implementation({
          file_path: join(tempProjectDir, fileName),
          content
        });
        expect(writeResult.success).toBe(true);
      }

      // Verify all files were created correctly
      const files = readdirSync(tempProjectDir);
      expect(files.length).toBe(testFiles.length);

      for (const fileName of testFiles) {
        expect(files).toContain(fileName);

        // Read each file to verify content
        const readResult = await Read.implementation({
          file_path: join(tempProjectDir, fileName)
        });
        expect(readResult.success).toBe(true);
        expect(readResult.message).toContain(`fileName = "${fileName}"`);
      }

      // Discover and analyze files
      const codeFiles = getCodeFiles(tempProjectDir);
      expect(codeFiles.length).toBe(testFiles.length);

      const analysisResults = analyzeFiles(codeFiles);
      expect(analysisResults.length).toBe(testFiles.length);
    });

    it("should handle files with unicode characters and special encodings", async () => {
      const unicodeFiles = [
        {
          name: "unicode-test.ts",
          content: "// 测试文件\nexport const message = 'Hello 世界! 🚀';"
        },
        {
          name: "emoji-test.ts",
          content: "// 🎉 Fun file\nexport const emoji = '🎨 🚀 ⭐ 🌟';"
        },
        {
          name: "accents-test.ts",
          content: "// Café résumé naïve\nexport const français = 'Bonjour';"
        }
      ];

      for (const file of unicodeFiles) {
        const writeResult = await Write.implementation({
          file_path: join(tempProjectDir, file.name),
          content: file.content
        });
        expect(writeResult.success).toBe(true);
      }

      // Read back to verify encoding preservation
      for (const file of unicodeFiles) {
        const readResult = await Read.implementation({
          file_path: join(tempProjectDir, file.name)
        });
        expect(readResult.success).toBe(true);
        expect(readResult.message).toBe(file.content);
      }

      // Edit unicode content
      const editResult = await Edit.implementation({
        file_path: join(tempProjectDir, "unicode-test.ts"),
        old_string: "Hello 世界!",
        new_string: "Hello Universe!"
      });
      expect(editResult.success).toBe(true);

      const editedContent = await Read.implementation({
        file_path: join(tempProjectDir, "unicode-test.ts")
      });
      expect(editedContent.success).toBe(true);
      expect(editedContent.message).toContain("Hello Universe! 🚀");
    });
  });

  describe("Integration with Actual Codebase", () => {
    it("should analyze the actual ink-cli project structure", async () => {
      // Skip if not in the actual ink-cli directory
      const packageJsonPath = join(realProjectDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        console.log("Skipping real project test - not in ink-cli directory");
        return;
      }

      // Read the actual package.json
      const readResult = await Read.implementation({
        file_path: packageJsonPath
      });
      expect(readResult.success).toBe(true);
      const packageJsonContent = readResult.message;

      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.name).toBe("@sage/cli"); // Based on the package.json we saw earlier

      // Discover code files in the real project
      const realCodeFiles = getCodeFiles(realProjectDir);

      // Should find TypeScript/JavaScript files in the project
      expect(realCodeFiles.length).toBeGreaterThan(0);
      expect(realCodeFiles.some(f => f.includes("src/"))).toBe(true);

      // Analyze a subset of real files (to avoid long test times)
      const sampleFiles = realCodeFiles.slice(0, 5);
      const analysisResults = analyzeFiles(sampleFiles);

      expect(analysisResults.length).toBeLessThanOrEqual(5);
      expect(analysisResults.length).toBeGreaterThan(0);

      // Should find real entities from the codebase
      const allEntities = analysisResults.flatMap(r => r.entities);
      expect(allEntities.length).toBeGreaterThan(0);
    });

    it("should work with git repositories and version control", async () => {
      // Initialize git repo in temp directory
      const initResult = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git init`
      });
      expect(initResult.success).toBe(true);

      // Create some files
      const gitFiles = ["src/index.ts", "README.md", ".gitignore"];

      for (const filePath of gitFiles) {
        const dir = join(tempProjectDir, filePath.split("/").slice(0, -1).join("/"));
        if (dir !== tempProjectDir) {
          mkdirSync(dir, { recursive: true });
        }

        let content = "";
        if (filePath.endsWith(".ts")) {
          content = `// ${filePath}\nexport function main() {\n  console.log("Hello from ${filePath}");\n}`;
        } else if (filePath === "README.md") {
          content = "# Test Project\n\nThis is a test project.";
        } else if (filePath === ".gitignore") {
          content = "node_modules/\ndist/\n*.log";
        }

        const writeResult = await Write.implementation({
          file_path: join(tempProjectDir, filePath),
          content
        });
        expect(writeResult.success).toBe(true);
      }

      // Add files to git
      const addResult = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git add .`
      });
      expect(addResult.success).toBe(true);

      // Configure git user for commit
      const configEmailResult = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git config user.email "test@example.com"`
      });
      expect(configEmailResult.success).toBe(true);
      const configNameResult = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git config user.name "Test User"`
      });
      expect(configNameResult.success).toBe(true);

      // Make initial commit
      const commitResult = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git commit -m "Initial commit"`
      });
      expect(commitResult.success).toBe(true);

      // Verify git repo structure
      const gitStatus = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git status --porcelain`
      });
      expect(gitStatus.success).toBe(true);
      expect(gitStatus.message.trim()).toBe(""); // Should be clean

      // Get code files (should exclude .git directory)
      const codeFiles = getCodeFiles(tempProjectDir);
      expect(codeFiles.some(f => f.includes("src/index.ts"))).toBe(true);
      expect(codeFiles.some(f => f.includes(".git"))).toBe(false);

      // Make changes and track with git
      const editResult = await Edit.implementation({
        file_path: join(tempProjectDir, "src", "index.ts"),
        old_string: "Hello from src/index.ts",
        new_string: "Hello from modified src/index.ts"
      });
      expect(editResult.success).toBe(true);

      // Check git diff
      const gitDiff = await Bash.implementation({
        command: `cd "${tempProjectDir}" && git diff`
      });
      expect(gitDiff.success).toBe(true);
      expect(gitDiff.message).toContain("modified src/index.ts");
    });
  });

  describe("Performance with Real File Systems", () => {
    it("should handle large file operations efficiently", async () => {
      // Create a large file
      const largeContent =
        "export const data = [\n" +
        Array(10000)
          .fill(0)
          .map((_, i) => `  { id: ${i}, value: "item-${i}" }`)
          .join(",\n") +
        "\n];";

      const largeFile = join(tempProjectDir, "large-data.ts");

      const startTime = Date.now();

      const writeResult = await Write.implementation({
        file_path: largeFile,
        content: largeContent
      });
      expect(writeResult.success).toBe(true);

      const writeTime = Date.now() - startTime;
      expect(writeTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Read large file
      const readStartTime = Date.now();
      const readResult = await Read.implementation({
        file_path: largeFile
      });
      expect(readResult.success).toBe(true);
      const readTime = Date.now() - readStartTime;

      expect(readTime).toBeLessThan(2000); // Should read within 2 seconds
      expect(typeof readResult.message).toBe("string");
      expect(readResult.message.length).toBe(largeContent.length);

      // Edit large file
      const editStartTime = Date.now();
      const editResult = await Edit.implementation({
        file_path: largeFile,
        old_string: "export const data",
        new_string: "export const largeData"
      });
      expect(editResult.success).toBe(true);
      const editTime = Date.now() - editStartTime;

      expect(editTime).toBeLessThan(3000); // Should edit within 3 seconds
    });

    it("should handle concurrent file operations on real filesystem", async () => {
      const concurrentFiles = Array(20)
        .fill(0)
        .map((_, i) => ({
          path: join(tempProjectDir, `concurrent-${i}.ts`),
          content: `// Concurrent file ${i}
export const value${i} = ${i};
export function process${i}(input: number) {
  return input * ${i};
}`
        }));

      const startTime = Date.now();

      // Write all files concurrently
      const writeResults = await Promise.all(
        concurrentFiles.map(file =>
          Write.implementation({
            file_path: file.path,
            content: file.content
          })
        )
      );
      expect(writeResults.every(r => r.success)).toBe(true);

      const writeTime = Date.now() - startTime;
      expect(writeTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Read all files concurrently
      const readStartTime = Date.now();
      const readResults = await Promise.all(
        concurrentFiles.map(file => Read.implementation({ file_path: file.path }))
      );
      const readTime = Date.now() - readStartTime;

      expect(readTime).toBeLessThan(5000); // Should read within 5 seconds
      expect(readResults).toHaveLength(20);
      expect(
        readResults.every(
          result => result.success && typeof result.message === "string"
        )
      ).toBe(true);

      // Verify file system state
      const files = readdirSync(tempProjectDir);
      expect(files.length).toBe(20);
    });
  });
});
