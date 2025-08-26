import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRegistryInstallationStatus,
  installServerFromRegistry,
  isRegistryServerInstalled,
  syncFilesystemServers,
  uninstallServer
} from "../installation/index.js";

vi.mock("../state/index.js", () => ({
  mcpState: {
    serverConfigs: {},
    lastUpdated: 0
  }
}));

vi.mock("../client/index.js", () => ({
  mcpClientManager: {
    addServer: vi.fn(),
    disconnectServer: vi.fn(),
    removeServer: vi.fn()
  }
}));

vi.mock("../installation/filesystem.js", () => ({
  scanInstalledServers: vi.fn(),
  generateServerConfigs: vi.fn(),
  cloneServer: vi.fn(),
  removeServer: vi.fn(),
  isServerInstalled: vi.fn()
}));

vi.mock("../config/index.js", () => ({
  saveServerConfigs: vi.fn().mockResolvedValue(undefined),
  loadServerConfigs: vi.fn().mockResolvedValue(undefined)
}));

// Remove complex fs mocking - we'll use dependency injection instead

vi.mock("@/utils/directories.js", () => ({
  sage: "/mock/home/.sage",
  config: "/mock/home/.sage/config.json",
  threads: "/mock/home/.sage/threads"
}));

vi.mock("os", async importOriginal => {
  const actual = await importOriginal<typeof import("os")>();
  const osMock = {
    ...actual,
    homedir: () => "/mock/home"
  };
  return {
    ...osMock,
    default: osMock
  };
});

import {
  cloneServer,
  generateServerConfigs,
  isServerInstalled,
  mcpClientManager,
  mcpState,
  removeServer,
  scanInstalledServers
} from "../index.js";
import type { FileSystemOps, OsOps, PathOps } from "../installation/actions.js";

const mockScanInstalledServers = vi.mocked(scanInstalledServers);
const mockGenerateServerConfigs = vi.mocked(generateServerConfigs);
const mockCloneServer = vi.mocked(cloneServer);
const mockRemoveServer = vi.mocked(removeServer);
const mockIsServerInstalled = vi.mocked(isServerInstalled);
const mockMcpClientManager = vi.mocked(mcpClientManager);
// Create mock dependencies for testing
const mockFileSystem: FileSystemOps = {
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined)
  }
};

const mockPathOps: PathOps = {
  join: vi.fn((...paths: string[]) => paths.join("/")),
  dirname: vi.fn((path: string) => path.split("/").slice(0, -1).join("/")),
  basename: vi.fn((path: string) => path.split("/").pop() || "") // Add this line
};

const mockOsOps: OsOps = {
  homedir: vi.fn(() => "/mock/home")
};

describe("MCP Actions Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset state
    Object.keys(mcpState.serverConfigs).forEach(key => {
      delete mcpState.serverConfigs[key];
    });

    // Default mock implementations
    mockScanInstalledServers.mockReturnValue([]);
    mockGenerateServerConfigs.mockReturnValue([]);
    mockIsServerInstalled.mockReturnValue(false);
    // mockFs.promises.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncFilesystemServers", () => {
    it("should add newly discovered servers to config", async () => {
      const mockConfig = {
        id: "test-server",
        name: "test-server",
        type: "stdio" as const,
        command: "python3",
        args: ["/path/to/server/server.py"],
        enabled: false,
        env: { PYTHONPATH: "/path/to/server" }
      };

      // Setup mock filesystem dependencies
      (mockFileSystem.existsSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return true;
        return false;
      });

      (mockFileSystem.readdirSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return ["test-server"];
        return [];
      });

      (mockFileSystem.statSync as any).mockReturnValue({ isDirectory: () => true });

      mockGenerateServerConfigs.mockReturnValue([mockConfig]);

      await syncFilesystemServers({
        fileSystem: mockFileSystem,
        pathOps: mockPathOps,
        osOps: mockOsOps
      });

      expect(mockGenerateServerConfigs).toHaveBeenCalledWith(
        "/mock/home/.sage/servers/test-server",
        "test-server",
        "filesystem:test-server"
      );
      expect(mcpState.serverConfigs["test-server"]).toEqual(mockConfig);
    });

    it("should not add servers that already exist in config", async () => {
      const mockConfig = {
        id: "existing-server",
        name: "existing-server",
        type: "stdio" as const,
        command: "python3",
        args: ["/path/to/server/server.py"],
        enabled: false,
        env: { PYTHONPATH: "/path/to/server" }
      };

      // Pre-populate state
      mcpState.serverConfigs["existing-server"] = mockConfig;

      // Setup mock filesystem dependencies
      (mockFileSystem.existsSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return true;
        return false;
      });

      (mockFileSystem.readdirSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return ["existing-server"];
        return [];
      });

      (mockFileSystem.statSync as any).mockReturnValue({ isDirectory: () => true });

      mockGenerateServerConfigs.mockReturnValue([mockConfig]);

      await syncFilesystemServers({
        fileSystem: mockFileSystem,
        pathOps: mockPathOps,
        osOps: mockOsOps
      });

      // Config should still be there, but not duplicated
      expect(mcpState.serverConfigs["existing-server"]).toEqual(mockConfig);
      expect(Object.keys(mcpState.serverConfigs)).toHaveLength(1);
    });

    it("should remove configs for servers no longer on filesystem", async () => {
      // Pre-populate state with a filesystem server
      mcpState.serverConfigs["removed-server"] = {
        id: "removed-server",
        name: "removed-server",
        type: "stdio",
        command: "python3",
        args: ["/.sage/servers/removed-server/server.py"],
        enabled: false
      };

      // Mock filesystem to have no server directories (empty)
      (mockFileSystem.existsSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return true;
        return false;
      });

      (mockFileSystem.readdirSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return [] as any; // No servers
        return [] as any;
      });

      await syncFilesystemServers({
        fileSystem: mockFileSystem,
        pathOps: mockPathOps,
        osOps: mockOsOps
      });

      expect(mcpState.serverConfigs["removed-server"]).toBeUndefined();
    });

    it("should not remove non-filesystem servers", async () => {
      // Pre-populate state with an HTTP server
      mcpState.serverConfigs["http-server"] = {
        id: "http-server",
        name: "HTTP Server",
        type: "http",
        url: "http://localhost:3000",
        enabled: true
      };

      // Mock filesystem to have no server directories (empty)
      (mockFileSystem.existsSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return true;
        return false;
      });

      (mockFileSystem.readdirSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return [] as any; // No servers
        return [] as any;
      });

      await syncFilesystemServers({
        fileSystem: mockFileSystem,
        pathOps: mockPathOps,
        osOps: mockOsOps
      });

      // HTTP server should still be there
      expect(mcpState.serverConfigs["http-server"]).toBeDefined();
    });

    it("should handle servers with no valid config", async () => {
      // Mock filesystem to have a server directory
      (mockFileSystem.existsSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return true;
        return false;
      });

      (mockFileSystem.readdirSync as any).mockImplementation((path: string) => {
        if (path.includes(".sage/servers")) return ["invalid-server"] as any;
        return [] as any;
      });

      (mockFileSystem.statSync as any).mockReturnValue({
        isDirectory: () => true
      } as any);

      mockGenerateServerConfigs.mockReturnValue([]); // No valid configs

      await syncFilesystemServers({
        fileSystem: mockFileSystem,
        pathOps: mockPathOps,
        osOps: mockOsOps
      });

      expect(mcpState.serverConfigs["invalid-server"]).toBeUndefined();
    });
  });

  describe("installServerFromRegistry", () => {
    it("should successfully install a server", async () => {
      const registryServer = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        description: "Test server"
      };

      const mockConfig = {
        id: "test-server",
        name: "test-server",
        type: "stdio" as const,
        command: "python3",
        args: ["/path/to/server/server.py"],
        enabled: false,
        env: { PYTHONPATH: "/path/to/server" }
      };

      mockIsServerInstalled.mockReturnValue(false);
      mockCloneServer.mockResolvedValue("/path/to/server");
      mockGenerateServerConfigs.mockReturnValue([mockConfig]);
      mockMcpClientManager.addServer.mockResolvedValue(undefined);

      // Mock filesystem operations for installServerDependencies
      (mockFileSystem.readdirSync as any).mockReturnValue([]);
      (mockFileSystem.statSync as any).mockReturnValue({
        isDirectory: () => false
      } as any);

      await installServerFromRegistry(registryServer, {
        fileSystem: mockFileSystem,
        pathOps: mockPathOps
      });

      expect(mockCloneServer).toHaveBeenCalledWith(
        "https://github.com/user/test-server",
        "test-server"
      );
      expect(mockGenerateServerConfigs).toHaveBeenCalledWith(
        "/path/to/server",
        "test-server",
        "https://github.com/user/test-server"
      );
      expect(mcpState.serverConfigs["test-server"]).toEqual(mockConfig);
      expect(mockMcpClientManager.addServer).toHaveBeenCalledWith(mockConfig);
      // saveServerConfigs is mocked, so we don't need to test this
    });

    it("should throw error if server is already installed", async () => {
      const registryServer = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        description: "Test server"
      };

      mockIsServerInstalled.mockReturnValue(true);

      await expect(installServerFromRegistry(registryServer)).rejects.toThrow(
        "Server test-server is already installed"
      );

      expect(mockCloneServer).not.toHaveBeenCalled();
    });

    it("should handle clone failure", async () => {
      const registryServer = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        description: "Test server"
      };

      mockIsServerInstalled.mockReturnValue(false);
      mockCloneServer.mockRejectedValue(new Error("Clone failed"));

      await expect(installServerFromRegistry(registryServer)).rejects.toThrow(
        "Failed to install test-server:"
      );
    });

    it("should handle server with no detectable entry point", async () => {
      const registryServer = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        description: "Test server"
      };

      mockIsServerInstalled.mockReturnValue(false);
      mockCloneServer.mockResolvedValue("/path/to/server");
      mockGenerateServerConfigs.mockReturnValue([]); // No valid configs

      // Mock filesystem operations for installServerDependencies
      (mockFileSystem.readdirSync as any).mockReturnValue([]);
      (mockFileSystem.statSync as any).mockReturnValue({
        isDirectory: () => false
      } as any);

      await installServerFromRegistry(registryServer, {
        fileSystem: mockFileSystem,
        pathOps: mockPathOps
      });

      // Should not crash, but no config should be added
      expect(mcpState.serverConfigs["test-server"]).toBeUndefined();
      // saveServerConfigs is mocked, so no filesystem operations expected
    });
  });

  describe("uninstallServer", () => {
    it("should successfully uninstall a filesystem server", async () => {
      const mockConfig = {
        id: "test-server",
        name: "test-server",
        type: "stdio" as const,
        command: "python3",
        args: ["/path/to/server/server.py"],
        enabled: false
      };

      const mockServerMetadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        entryPoint: "/path/to/server/server.py",
        entryType: "python" as const,
        hasPackageJson: false,
        hasPythonFile: true
      };

      mcpState.serverConfigs["test-server"] = mockConfig;
      mockScanInstalledServers.mockReturnValue([mockServerMetadata]);
      mockMcpClientManager.disconnectServer.mockResolvedValue(undefined);
      mockMcpClientManager.removeServer.mockResolvedValue(undefined);
      mockRemoveServer.mockResolvedValue(undefined);

      await uninstallServer("test-server");

      expect(mockMcpClientManager.disconnectServer).toHaveBeenCalledWith(
        "test-server"
      );
      expect(mockRemoveServer).toHaveBeenCalledWith(
        "https://github.com/user/test-server"
      );
      expect(mcpState.serverConfigs["test-server"]).toBeUndefined();
      expect(mockMcpClientManager.removeServer).toHaveBeenCalledWith("test-server");
      // saveServerConfigs is mocked, so we don't need to test this
    });

    it("should throw error if server not found in config", async () => {
      await expect(uninstallServer("non-existent")).rejects.toThrow(
        "Server repository non-existent not found in configuration"
      );
    });

    it("should throw error if server is not filesystem-based", async () => {
      const mockConfig = {
        id: "http-server",
        name: "HTTP Server",
        type: "http" as const,
        url: "http://localhost:3000",
        enabled: true
      };

      mcpState.serverConfigs["http-server"] = mockConfig;
      mockScanInstalledServers.mockReturnValue([]); // No filesystem servers

      await expect(uninstallServer("http-server")).rejects.toThrow(
        "Cannot uninstall http-server: not a filesystem-based server"
      );
    });

    it("should handle removal failure gracefully", async () => {
      const mockConfig = {
        id: "test-server",
        name: "test-server",
        type: "stdio" as const,
        command: "python3",
        args: ["/path/to/server/server.py"],
        enabled: false
      };

      const mockServerMetadata = {
        name: "test-server",
        github: "https://github.com/user/test-server",
        installedPath: "/path/to/server",
        entryPoint: "/path/to/server/server.py",
        entryType: "python" as const,
        hasPackageJson: false,
        hasPythonFile: true
      };

      mcpState.serverConfigs["test-server"] = mockConfig;
      mockScanInstalledServers.mockReturnValue([mockServerMetadata]);
      mockMcpClientManager.disconnectServer.mockResolvedValue(undefined);
      mockMcpClientManager.removeServer.mockResolvedValue(undefined);
      mockRemoveServer.mockRejectedValue(new Error("Permission denied"));

      await expect(uninstallServer("test-server")).rejects.toThrow(
        "Failed to uninstall test-server:"
      );
    });
  });

  describe("isRegistryServerInstalled", () => {
    it("should return true if server is installed", () => {
      const server = { github: "https://github.com/user/test-server" };
      mockIsServerInstalled.mockReturnValue(true);

      const result = isRegistryServerInstalled(server);

      expect(result).toBe(true);
      expect(mockIsServerInstalled).toHaveBeenCalledWith(
        "https://github.com/user/test-server"
      );
    });

    it("should return false if server is not installed", () => {
      const server = { github: "https://github.com/user/test-server" };
      mockIsServerInstalled.mockReturnValue(false);

      const result = isRegistryServerInstalled(server);

      expect(result).toBe(false);
    });
  });

  describe("getRegistryInstallationStatus", () => {
    it("should return installation status for all servers", () => {
      const registry = [
        { name: "server1", github: "https://github.com/user/server1" },
        { name: "server2", github: "https://github.com/user/server2" },
        { name: "server3", github: "https://github.com/user/server3" }
      ];

      mockIsServerInstalled
        .mockReturnValueOnce(true) // server1 installed
        .mockReturnValueOnce(false) // server2 not installed
        .mockReturnValueOnce(true); // server3 installed

      const result = getRegistryInstallationStatus(registry);

      expect(result).toEqual({
        server1: true,
        server2: false,
        server3: true
      });
    });

    it("should handle empty registry", () => {
      const result = getRegistryInstallationStatus([]);
      expect(result).toEqual({});
    });
  });
});
