import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { existsSync } from "fs";

/**
 * Golden snapshot testing utility
 * Compares files against stored snapshots in __snapshots__ directory
 */
export async function golden(
  ws: { root: string },
  path: string
): Promise<void> {
  const sourceFile = join(ws.root, path);
  const snapshotDir = join(dirname(sourceFile), "__snapshots__");
  const baseName = basename(path, extname(path));
  const snapshotFile = join(snapshotDir, `${baseName}.golden`);
  
  // Read current content
  const currentContent = await readFile(sourceFile, "utf8");
  
  // Check if snapshot exists
  if (!existsSync(snapshotFile)) {
    // Create snapshot directory if needed
    if (!existsSync(snapshotDir)) {
      await mkdir(snapshotDir, { recursive: true });
    }
    
    // Write new snapshot
    await writeFile(snapshotFile, currentContent, "utf8");
    return;
  }
  
  // Compare with existing snapshot
  const expectedContent = await readFile(snapshotFile, "utf8");
  
  if (currentContent !== expectedContent) {
    const diff = createDiff(expectedContent, currentContent);
    throw new Error(`Golden snapshot mismatch for ${path}:\n${diff}`);
  }
}

/**
 * Creates a simple unified diff between two strings
 */
function createDiff(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const diff: string[] = [];
  
  diff.push("=== Expected ===");
  expectedLines.forEach((line, i) => {
    diff.push(`${i + 1}: ${line}`);
  });
  
  diff.push("=== Actual ===");
  actualLines.forEach((line, i) => {
    diff.push(`${i + 1}: ${line}`);
  });
  
  return diff.join('\n');
}

/**
 * Pretty directory comparison utility
 */
export async function expectDirEquals(
  ws: { root: string },
  expected: Record<string, string>
): Promise<void> {
  const actual = await buildWorkspaceTree(ws.root);
  
  const expectedKeys = new Set(Object.keys(expected));
  const actualKeys = new Set(Object.keys(actual));
  
  // Find differences
  const missing = [...expectedKeys].filter(k => !actualKeys.has(k));
  const extra = [...actualKeys].filter(k => !expectedKeys.has(k));
  const different: string[] = [];
  
  for (const key of expectedKeys) {
    if (actualKeys.has(key) && expected[key] !== actual[key]) {
      different.push(key);
    }
  }
  
  if (missing.length > 0 || extra.length > 0 || different.length > 0) {
    const errors: string[] = [];
    
    if (missing.length > 0) {
      errors.push(`Missing files: ${missing.join(', ')}`);
    }
    
    if (extra.length > 0) {
      errors.push(`Extra files: ${extra.join(', ')}`);
    }
    
    if (different.length > 0) {
      errors.push(`Different content: ${different.join(', ')}`);
      different.forEach(file => {
        const diff = createDiff(expected[file], actual[file]);
        errors.push(`\nDiff for ${file}:\n${diff}`);
      });
    }
    
    throw new Error(`Directory structure mismatch:\n${errors.join('\n')}`);
  }
}

/**
 * Helper to build workspace tree (similar to TempWorkspace.tree but standalone)
 */
async function buildWorkspaceTree(rootPath: string): Promise<Record<string, string>> {
  const { buildTree } = await import("./temp-fs.js");
  return buildTree(rootPath, rootPath);
}