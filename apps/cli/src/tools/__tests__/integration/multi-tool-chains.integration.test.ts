import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Bash } from "../../Bash.js";
import { Read } from "../../Read.js";
import { Write } from "../../Write.js";
import { Edit } from "../../Edit.js";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Multi-Tool Command Chain Integration Tests", () => {
  let tempDir: string;
  let testFile: string;
  let dataDir: string;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `multi-tool-chains-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "chain-test.txt");
    dataDir = join(tempDir, "data");
    mkdirSync(dataDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up test files before each test
    if (existsSync(testFile)) {
      rmSync(testFile);
    }
    // Clean up data directory contents
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true });
      mkdirSync(dataDir, { recursive: true });
    }
  });

  describe("Basic Tool Chain Workflows", () => {
    it("should execute Write → Read → Edit chain successfully", async () => {
      const originalContent = "Original content for chain test";

      // Step 1: Write initial content
      const writeResult = await Write.implementation({
        file_path: testFile,
        content: originalContent
      });
      expect(writeResult.success).toBe(true);

      // Step 2: Read content back
      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(originalContent);

      // Step 3: Edit the content
      const editResult = await Edit.implementation({
        file_path: testFile,
        old_string: "Original content",
        new_string: "Modified content"
      });
      expect(editResult.success).toBe(true);

      // Step 4: Verify final content
      const finalContent = await Read.implementation({
        file_path: testFile
      });
      expect(finalContent.success).toBe(true);
      expect(finalContent.message).toBe("Modified content for chain test");
    });

    it("should execute Bash → Read chain for file processing", async () => {
      const testData = "apple\nbanana\ncherry\napricot\nblueberry";
      const dataFile = join(dataDir, "fruits.txt");

      // Step 1: Create test data with Bash
      const bashCreateResult = await Bash.implementation({
        command: `echo "${testData}" > "${dataFile}"`
      });
      expect(bashCreateResult.success).toBe(true);
      expect(existsSync(dataFile)).toBe(true);

      // Step 2: Process with Bash (filter lines starting with 'a')
      const bashFilterResult = await Bash.implementation({
        command: `grep '^a' "${dataFile}" > "${dataFile}.filtered"`
      });
      expect(bashFilterResult.success).toBe(true);

      // Step 3: Read filtered results
      const readResult = await Read.implementation({
        file_path: `${dataFile}.filtered`
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toContain("apple");
      expect(readResult.message).toContain("apricot");
      expect(readResult.message).not.toContain("banana");
      expect(readResult.message).not.toContain("cherry");
    });

    it("should execute Read → Edit → Write chain for file transformation", async () => {
      const sourceFile = join(dataDir, "source.js");
      const targetFile = join(dataDir, "target.js");
      const jsContent = `function oldName() {
  console.log("Hello from oldName");
  return oldName.value;
}

const result = oldName();`;

      // Step 1: Create source file
      writeFileSync(sourceFile, jsContent);

      // Step 2: Read source content
      const readResult = await Read.implementation({
        file_path: sourceFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(jsContent);

      // Step 3: Write to target file
      const writeResult = await Write.implementation({
        file_path: targetFile,
        content: readResult.message as string
      });
      expect(writeResult.success).toBe(true);

      // Step 4: Edit target file (rename function)
      const editResult = await Edit.implementation({
        file_path: targetFile,
        old_string: "oldName",
        new_string: "newName",
        replace_all: true
      });
      expect(editResult.success).toBe(true);

      // Step 5: Verify transformation
      const finalContent = await Read.implementation({
        file_path: targetFile
      });
      expect(finalContent.success).toBe(true);
      expect(finalContent.message).toContain("function newName()");
      expect(finalContent.message).toContain('console.log("Hello from newName")');
      expect(finalContent.message).toContain("return newName.value");
      expect(finalContent.message).toContain("const result = newName()");
    });
  });

  describe("Complex Tool Chain Workflows", () => {
    it("should execute full development workflow: Bash (scaffold) → Write (code) → Edit (modify) → Read (verify)", async () => {
      const projectDir = join(dataDir, "test-project");

      // Step 1: Create project structure with Bash
      const scaffoldResult = await Bash.implementation({
        command: `mkdir -p "${projectDir}/src" "${projectDir}/tests" "${projectDir}/docs"`
      });
      expect(scaffoldResult.success).toBe(true);
      expect(existsSync(join(projectDir, "src"))).toBe(true);
      expect(existsSync(join(projectDir, "tests"))).toBe(true);
      expect(existsSync(join(projectDir, "docs"))).toBe(true);

      // Step 2: Write package.json
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        main: "src/index.js",
        scripts: {
          test: "echo 'No tests yet'",
          start: "node src/index.js"
        }
      };

      const writePackageResult = await Write.implementation({
        file_path: join(projectDir, "package.json"),
        content: JSON.stringify(packageJson, null, 2)
      });
      expect(writePackageResult.success).toBe(true);

      // Step 3: Write main index.js file
      const indexJs = `const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;

      const writeIndexResult = await Write.implementation({
        file_path: join(projectDir, "src", "index.js"),
        content: indexJs
      });
      expect(writeIndexResult.success).toBe(true);

      // Step 4: Edit to add error handling
      const editResult = await Edit.implementation({
        file_path: join(projectDir, "src", "index.js"),
        old_string: `app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});`,
        new_string: `app.get('/', (req, res) => {
  try {
    res.json({ message: 'Hello World', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});`
      });
      expect(editResult.success).toBe(true);

      // Step 5: Read final result to verify
      const finalIndexJs = await Read.implementation({
        file_path: join(projectDir, "src", "index.js")
      });
      expect(finalIndexJs.success).toBe(true);
      expect(finalIndexJs.message).toContain("try {");
      expect(finalIndexJs.message).toContain("timestamp: new Date().toISOString()");
      expect(finalIndexJs.message).toContain("} catch (error) {");

      // Step 6: Verify project structure with Bash
      const lsResult = await Bash.implementation({
        command: `find "${projectDir}" -type f -name "*.js" -o -name "*.json"`
      });
      expect(lsResult.success).toBe(true);
      expect(lsResult.message).toContain("package.json");
      expect(lsResult.message).toContain("src/index.js");
    });

    it("should execute data processing pipeline: Bash (generate) → Read → Edit (transform) → Write → Bash (verify)", async () => {
      const csvFile = join(dataDir, "data.csv");
      const processedFile = join(dataDir, "processed.csv");

      // Step 1: Generate CSV data with Bash
      const generateResult = await Bash.implementation({
        command: `echo "name,age,city
John,25,NYC
Jane,30,LA
Bob,35,Chicago
Alice,28,Boston" > "${csvFile}"`
      });
      expect(generateResult.success).toBe(true);

      // Step 2: Read CSV data
      const csvContent = await Read.implementation({
        file_path: csvFile
      });
      expect(csvContent.success).toBe(true);
      expect(csvContent.message).toContain("name,age,city");
      expect(csvContent.message).toContain("John,25,NYC");

      // Step 3: Transform data (add header and modify format)
      const editHeaderResult = await Edit.implementation({
        file_path: csvFile,
        old_string: "name,age,city",
        new_string: "full_name,years_old,location"
      });
      expect(editHeaderResult.success).toBe(true);

      // Step 4: Read transformed content
      const transformedContent = await Read.implementation({
        file_path: csvFile
      });
      expect(transformedContent.success).toBe(true);

      // Step 5: Write processed version with additional processing
      const processedContent = (transformedContent.message as string)
        .split("\n")
        .map(line => {
          if (line.includes(",")) {
            const [name, age, city] = line.split(",");
            if (name !== "full_name" && name.trim() !== "") {
              // Skip header and empty lines
              return `${name.toUpperCase()},${age},${city.toUpperCase()}`;
            }
          }
          return line;
        })
        .join("\n");

      const writeProcessedResult = await Write.implementation({
        file_path: processedFile,
        content: processedContent
      });
      expect(writeProcessedResult.success).toBe(true);

      // Step 6: Verify with Bash
      const verifyResult = await Bash.implementation({
        command: `wc -l "${processedFile}" && head -3 "${processedFile}"`
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.message).toContain("JOHN,25,NYC");
      expect(verifyResult.message).toContain("JANE,30,LA");
    });
  });

  describe("Error Handling in Tool Chains", () => {
    it("should handle partial chain failures gracefully", async () => {
      const nonExistentFile = join(dataDir, "does-not-exist.txt");

      // Step 1: Try to read non-existent file (should fail)
      const readResult = await Read.implementation({
        file_path: nonExistentFile
      });
      expect(readResult.success).toBe(false);
      expect(readResult.message).toContain("ENOENT");

      // Step 2: Continue with Write (should succeed)
      const writeResult = await Write.implementation({
        file_path: testFile,
        content: "Recovery content"
      });
      expect(writeResult.success).toBe(true);

      // Step 3: Verify recovery
      const verifyResult = await Read.implementation({
        file_path: testFile
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.message).toBe("Recovery content");
    });

    it("should handle Edit failures in chain context", async () => {
      const content = "Test content without target string";

      // Step 1: Write content
      await Write.implementation({
        file_path: testFile,
        content
      });

      // Step 2: Try to edit non-existent string (should succeed but make no changes)
      const editResult = await Edit.implementation({
        file_path: testFile,
        old_string: "non-existent string",
        new_string: "replacement"
      });
      expect(editResult.success).toBe(true);

      // Step 3: Verify file unchanged
      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe(content);
    });

    it("should handle Bash command failures in chain", async () => {
      // Step 1: Execute invalid Bash command (should fail)
      const bashResult = await Bash.implementation({
        command: "nonexistentcommand --invalid"
      });
      expect(bashResult.success).toBe(false);
      expect(bashResult.message.toLowerCase()).toContain("not found");

      // Step 2: Continue with valid operations
      const writeResult = await Write.implementation({
        file_path: testFile,
        content: "Content after Bash failure"
      });
      expect(writeResult.success).toBe(true);

      // Step 3: Verify recovery
      const readResult = await Read.implementation({
        file_path: testFile
      });
      expect(readResult.success).toBe(true);
      expect(readResult.message).toBe("Content after Bash failure");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large file processing chains efficiently", async () => {
      const largeFile = join(dataDir, "large.txt");
      const largeLine = "A".repeat(1000);
      const largeContent = Array(1000).fill(largeLine).join("\n");

      const startTime = Date.now();

      // Step 1: Write large content
      const writeResult = await Write.implementation({
        file_path: largeFile,
        content: largeContent
      });
      expect(writeResult.success).toBe(true);

      // Step 2: Read large content
      const readResult = await Read.implementation({
        file_path: largeFile
      });
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.message.length).toBe(largeContent.length);
      }

      // Step 3: Edit large content (replace A with B)
      const editResult = await Edit.implementation({
        file_path: largeFile,
        old_string: largeLine,
        new_string: "B".repeat(1000),
        replace_all: true
      });
      expect(editResult.success).toBe(true);

      // Step 4: Verify with Bash
      const verifyResult = await Bash.implementation({
        command: `head -1 "${largeFile}" | cut -c1-10`
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.message).toContain("BBBBBBBBBB");

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it("should handle complex nested tool chains", async () => {
      const configDir = join(dataDir, "config");
      const mkdirResult = await Bash.implementation({
        command: `mkdir -p "${configDir}"`
      });
      expect(mkdirResult.success).toBe(true);

      // Create multiple config files through tool chains
      const configs = ["app.json", "database.json", "cache.json"];

      for (const configName of configs) {
        const configFile = join(configDir, configName);

        // Write base config
        await Write.implementation({
          file_path: configFile,
          content: `{
  "name": "${configName.replace(".json", "")}",
  "enabled": false,
  "settings": {}
}`
        });

        // Edit to enable
        await Edit.implementation({
          file_path: configFile,
          old_string: '"enabled": false',
          new_string: '"enabled": true'
        });

        // Add timestamp with Edit
        await Edit.implementation({
          file_path: configFile,
          old_string: '"settings": {}',
          new_string: `"settings": {},
  "updated": "${new Date().toISOString()}"`
        });

        // Verify each config
        const content = await Read.implementation({
          file_path: configFile
        });
        expect(content.success).toBe(true);
        expect(content.message).toContain('"enabled": true');
        expect(content.message).toContain('"updated":');
      }

      // Final verification with Bash
      const listResult = await Bash.implementation({
        command: `ls "${configDir}" | wc -l`
      });
      expect(listResult.success).toBe(true);
      expect(listResult.message.trim()).toBe("3");
    });
  });
});
