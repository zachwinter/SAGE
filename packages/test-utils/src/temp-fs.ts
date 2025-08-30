import { existsSync, mkdirSync, writeFileSync } from "fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, normalize, relative } from "path";

/**
 * Test utility for creating temporary directories and files
 * Eliminates the need for filesystem mocking in tests
 */
export class TempFS {
  private tempDir: string | null = null;

  /**
   * Creates a unique temporary directory for the test
   */
  async create(): Promise<string> {
    this.tempDir = await mkdtemp(join(tmpdir(), "sage-test-"));
    return this.tempDir;
  }

  /**
   * Gets the current temp directory path
   */
  getPath(): string {
    if (!this.tempDir) {
      throw new Error("TempFS not initialized. Call create() first.");
    }
    return this.tempDir;
  }

  /**
   * Creates a file with content in the temp directory
   */
  async writeFile(relativePath: string, content: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    const dir = join(fullPath, "..");

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, content, "utf8");
    return fullPath;
  }

  /**
   * Creates a file synchronously with content in the temp directory
   */
  writeFileSync(relativePath: string, content: string): string {
    const fullPath = this.resolvePath(relativePath);
    const dir = join(fullPath, "..");

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, "utf8");
    return fullPath;
  }

  /**
   * Reads a file from the temp directory
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    return readFile(fullPath, "utf8");
  }

  /**
   * Creates a directory in the temp directory
   */
  async mkdir(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
  }

  /**
   * Creates a directory synchronously in the temp directory
   */
  mkdirSync(relativePath: string): string {
    const fullPath = this.resolvePath(relativePath);
    mkdirSync(fullPath, { recursive: true });
    return fullPath;
  }

  /**
   * Checks if a file/directory exists in the temp directory
   */
  exists(relativePath: string): boolean {
    const fullPath = this.resolvePath(relativePath);
    return existsSync(fullPath);
  }

  /**
   * Resolves a relative path within the temp directory
   */
  resolvePath(relativePath: string): string {
    if (!this.tempDir) {
      throw new Error("TempFS not initialized. Call create() first.");
    }
    return join(this.tempDir, relativePath);
  }

  /**
   * Creates a mock home directory structure for testing
   */
  async createMockHome(): Promise<{
    homedir: string;
    sage: string;
    config: string;
    threads: string;
  }> {
    const homedir = await this.mkdir("home");
    const sage = await this.mkdir("home/.sage");
    const threads = await this.mkdir("home/.sage/threads");
    const config = this.resolvePath("home/.sage/config.json");

    return {
      homedir,
      sage,
      config,
      threads
    };
  }

  /**
   * Cleans up the temporary directory
   */
  async cleanup(): Promise<void> {
    if (this.tempDir) {
      try {
        await rm(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${this.tempDir}:`, error);
      }
      this.tempDir = null;
    }
  }
}

/**
 * Creates a new TempFS instance for testing
 */
export function createTempFS(): TempFS {
  return new TempFS();
}

/**
 * Helper for creating a temp directory with automatic cleanup
 */
export async function withTempDir<T>(
  fn: (tempFs: TempFS) => Promise<T>
): Promise<T> {
  const tempFs = createTempFS();
  try {
    await tempFs.create();
    return await fn(tempFs);
  } finally {
    await tempFs.cleanup();
  }
}

/**
 * CONTRACT.md compliant workspace interface
 */
export interface TempWorkspace {
  root: string;
  file(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
  tree(): Promise<Record<string, string>>;
}

/**
 * Creates a temporary workspace matching CONTRACT.md specification
 */
export async function createTempWorkspace(opts?: {
  prefix?: string;
  clock?: { now(): string };
}): Promise<TempWorkspace> {
  const prefix = opts?.prefix ?? "sage-test-";
  const root = await mkdtemp(join(tmpdir(), prefix));

  const workspace: TempWorkspace = {
    root,

    async file(path: string, content: string): Promise<void> {
      const safePath = validatePath(path);
      const fullPath = join(root, safePath);
      const dir = join(fullPath, "..");

      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(fullPath, content, "utf8");
    },

    async read(path: string): Promise<string> {
      const safePath = validatePath(path);
      const fullPath = join(root, safePath);
      return await readFile(fullPath, "utf8");
    },

    async tree(): Promise<Record<string, string>> {
      return await buildTree(root, root);
    }
  };

  // Auto-cleanup registration (if test framework supports it)
  if (
    typeof globalThis !== "undefined" &&
    "afterEach" in globalThis &&
    typeof (globalThis as any).afterEach === "function"
  ) {
    (globalThis as any).afterEach(async () => {
      try {
        await rm(root, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp workspace ${root}:`, error);
      }
    });
  }

  return workspace;
}

/**
 * Validates and normalizes paths to prevent escaping workspace
 */
function validatePath(path: string): string {
  // Reject absolute paths first
  if (path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Absolute paths not allowed: ${path}`);
  }

  // Reject null bytes
  if (path.includes("\0")) {
    throw new Error(`Invalid path: ${path}`);
  }

  // Normalize and resolve path
  const normalized = normalize(path);

  // Reject paths that escape workspace (contain .. after normalization)
  if (normalized.includes("..") || normalized.startsWith("..")) {
    throw new Error(`Path cannot escape workspace: ${path}`);
  }

  // Final check for dangerous patterns after normalization
  if (normalized.startsWith("/") || normalized.startsWith("\\")) {
    throw new Error(`Invalid path: ${path}`);
  }

  return normalized;
}

/**
 * Recursively builds a tree structure of files and their content
 */
export async function buildTree(
  rootPath: string,
  currentPath: string
): Promise<Record<string, string>> {
  const tree: Record<string, string> = {};

  try {
    const entries = await readdir(currentPath);

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stats = await stat(fullPath);
      const relativePath = relative(rootPath, fullPath);

      if (stats.isDirectory()) {
        const subTree = await buildTree(rootPath, fullPath);
        Object.assign(tree, subTree);
      } else if (stats.isFile()) {
        try {
          tree[relativePath] = await readFile(fullPath, "utf8");
        } catch {
          // Skip files that can't be read as text
          tree[relativePath] = "<binary>";
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return tree;
}
