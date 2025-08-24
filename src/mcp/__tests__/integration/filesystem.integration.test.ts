import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import {
  cloneServer,
  detectServerEntryPoints,
  removeServer,
  isServerInstalled,
  getServerPath,
  ensureServersDirectory
} from "../../installation/filesystem";

// Helper function to create a temporary directory
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
};

describe("Filesystem Integration", () => {
  let tempDir: string;
  let remoteRepoPath: string;

  beforeAll(() => {
    // Create a temporary directory for all tests
    tempDir = createTempDir();
    ensureServersDirectory(); // Ensure the main ~/.sage/servers dir exists for context

    // Create a bare git repository to act as a remote
    remoteRepoPath = path.join(tempDir, "remote-repo.git");
    fs.mkdirSync(remoteRepoPath);
    execSync("git init --bare", { cwd: remoteRepoPath });

    // Clone, add a file, and push to the bare repo
    const localClonePath = path.join(tempDir, "local-clone");
    execSync(`git clone "${remoteRepoPath}" "${localClonePath}"`);
    fs.writeFileSync(path.join(localClonePath, "server.py"), "print('hello')");
    execSync("git add .", { cwd: localClonePath });
    execSync("git commit -m 'Initial commit'", { cwd: localClonePath });
    execSync("git push origin master", { cwd: localClonePath });
  });

  afterAll(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up any cloned servers after each test
    const serverPath = getServerPath(remoteRepoPath);
    if (fs.existsSync(serverPath)) {
      await removeServer(remoteRepoPath);
    }
  });

  it("should clone a repository to the correct location", async () => {
    const serverPath = await cloneServer(remoteRepoPath, "test-server");

    // The server path should be inside the ~/.sage/servers directory
    const expectedServerPath = getServerPath(remoteRepoPath);

    expect(serverPath).toBe(expectedServerPath);
    expect(fs.existsSync(serverPath)).toBe(true);
    expect(fs.existsSync(path.join(serverPath, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(serverPath, "server.py"))).toBe(true);
  });

  it("should detect a python entry point in a cloned repository", async () => {
    const serverPath = await cloneServer(remoteRepoPath, "test-server-2");
    const entryPoints = detectServerEntryPoints(serverPath);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0].entryType).toBe("python");
    expect(entryPoints[0].entryPoint).toBe(path.join(serverPath, "server.py"));
  });

  it("should correctly check if a server is installed", async () => {
    await cloneServer(remoteRepoPath, "test-server-3");
    const installed = isServerInstalled(remoteRepoPath);
    expect(installed).toBe(true);
  });

  it("should remove an installed server", async () => {
    const serverPath = await cloneServer(remoteRepoPath, "test-server-4");
    expect(fs.existsSync(serverPath)).toBe(true);

    await removeServer(remoteRepoPath);
    expect(fs.existsSync(serverPath)).toBe(false);
  });
});
