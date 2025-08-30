import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { existsSync } from "fs";

/**
 * Golden snapshot testing utility
 * Compares workspace contents or individual files against stored snapshots
 */
export async function golden(
  ws: { root: string; tree?: () => Promise<Record<string, string>> },
  path: string
): Promise<void> {
  // Determine if this is a workspace snapshot or single file snapshot
  const isWorkspaceSnapshot = !path.includes('/') && !path.includes('.');
  
  let currentContent: string;
  let snapshotFile: string;
  
  if (isWorkspaceSnapshot) {
    // Workspace-wide snapshot
    const tree = ws.tree ? await ws.tree() : await buildWorkspaceTree(ws.root);
    currentContent = serializeWorkspaceTree(tree);
    
    // Store snapshot next to the test file (we'll derive this from process.cwd)
    const testDir = process.cwd();
    const snapshotDir = join(testDir, "__snapshots__");
    snapshotFile = join(snapshotDir, `${path}.golden`);
  } else {
    // Single file snapshot
    const sourceFile = join(ws.root, path);
    currentContent = await readFile(sourceFile, "utf8");
    
    const snapshotDir = join(dirname(sourceFile), "__snapshots__");
    const baseName = basename(path, extname(path));
    snapshotFile = join(snapshotDir, `${baseName}.golden`);
  }
  
  // Check if snapshot exists
  if (!existsSync(snapshotFile)) {
    // Create snapshot directory if needed
    const snapshotDir = dirname(snapshotFile);
    if (!existsSync(snapshotDir)) {
      await mkdir(snapshotDir, { recursive: true });
    }
    
    // Write new snapshot
    await writeFile(snapshotFile, currentContent, "utf8");
    console.log(`📸 Created golden snapshot: ${snapshotFile}`);
    return;
  }
  
  // Compare with existing snapshot
  const expectedContent = await readFile(snapshotFile, "utf8");
  
  if (currentContent !== expectedContent) {
    const diff = isWorkspaceSnapshot 
      ? createWorkspaceDiff(expectedContent, currentContent)
      : createDiff(expectedContent, currentContent);
    throw new Error(`Golden snapshot mismatch for ${path}:\n${diff}`);
  }
}

/**
 * Serializes a workspace tree into a deterministic string format
 * Keys are sorted alphabetically for consistent output
 */
function serializeWorkspaceTree(tree: Record<string, string>): string {
  const sortedKeys = Object.keys(tree).sort();
  const lines: string[] = [];
  
  for (const key of sortedKeys) {
    lines.push(`=== ${key} ===`);
    lines.push(tree[key]);
    lines.push(''); // Empty line separator
  }
  
  return lines.join('\n').trim();
}

/**
 * Creates enhanced diff for workspace trees
 */
function createWorkspaceDiff(expected: string, actual: string): string {
  const expectedTree = parseWorkspaceSnapshot(expected);
  const actualTree = parseWorkspaceSnapshot(actual);
  
  const expectedKeys = new Set(Object.keys(expectedTree));
  const actualKeys = new Set(Object.keys(actualTree));
  
  const diff: string[] = [];
  
  // Files only in expected (removed)
  const removed = [...expectedKeys].filter(k => !actualKeys.has(k));
  if (removed.length > 0) {
    diff.push(`❌ Removed files: ${removed.join(', ')}`);
  }
  
  // Files only in actual (added)  
  const added = [...actualKeys].filter(k => !expectedKeys.has(k));
  if (added.length > 0) {
    diff.push(`✅ Added files: ${added.join(', ')}`);
  }
  
  // Files in both but with different content
  const modified: string[] = [];
  for (const key of expectedKeys) {
    if (actualKeys.has(key) && expectedTree[key] !== actualTree[key]) {
      modified.push(key);
    }
  }
  
  if (modified.length > 0) {
    diff.push(`📝 Modified files: ${modified.join(', ')}`);
    diff.push('');
    
    for (const file of modified) {
      diff.push(`--- Expected: ${file} ---`);
      diff.push(expectedTree[file]);
      diff.push(`+++ Actual: ${file} +++`);
      diff.push(actualTree[file]);
      diff.push('');
    }
  }
  
  return diff.join('\n');
}

/**
 * Parses a workspace snapshot string back into a tree object
 */
function parseWorkspaceSnapshot(snapshot: string): Record<string, string> {
  const tree: Record<string, string> = {};
  const lines = snapshot.split('\n');
  let currentFile: string | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('=== ') && line.endsWith(' ===')) {
      // Save previous file if exists
      if (currentFile) {
        tree[currentFile] = currentContent.join('\n');
      }
      
      // Start new file
      currentFile = line.slice(4, -4);
      currentContent = [];
    } else if (currentFile) {
      currentContent.push(line);
    }
  }
  
  // Save final file
  if (currentFile) {
    tree[currentFile] = currentContent.join('\n').trim();
  }
  
  return tree;
}

/**
 * Creates a simple unified diff between two strings
 */
function createDiff(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const diff: string[] = [];
  
  diff.push("--- Expected ---");
  expectedLines.forEach((line, i) => {
    diff.push(`${(i + 1).toString().padStart(3)}: ${line}`);
  });
  
  diff.push("+++ Actual +++");
  actualLines.forEach((line, i) => {
    diff.push(`${(i + 1).toString().padStart(3)}: ${line}`);
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