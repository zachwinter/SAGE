import { describe, it, expect, vi } from "vitest";
import path from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

// Mock fs functions
vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
  existsSync: vi.fn()
}));

// Mock os functions
vi.mock("os", () => ({
  homedir: vi.fn()
}));

// Mock path functions
vi.mock("path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/"))
  }
}));

describe("directories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset modules to re-import directories.ts
    vi.resetModules();
  });

  it("should create .sage directory if it doesn't exist", async () => {
    // Mock homedir to return a test path
    vi.mocked(homedir).mockReturnValue("/test/home");
    
    // Mock existsSync to return false for .sage directory
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === "/test/home/.sage") return false;
      if (path === "/test/home/.sage/threads") return false;
      return true;
    });
    
    // Import the module after setting up mocks
    const directories = await import("../directories.js");
    
    // Verify that mkdirSync was called for .sage directory
    expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith("/test/home/.sage");
    
    // Verify exported values
    expect(directories.sage).toBe("/test/home/.sage");
    expect(directories.config).toBe("/test/home/.sage/config.json");
    expect(directories.threads).toBe("/test/home/.sage/threads");
  });

  it("should create threads directory if it doesn't exist", async () => {
    // Mock homedir to return a test path
    vi.mocked(homedir).mockReturnValue("/test/home");
    
    // Mock existsSync to return true for .sage but false for threads
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path === "/test/home/.sage") return true;
      if (path === "/test/home/.sage/threads") return false;
      return true;
    });
    
    // Import the module after setting up mocks
    const directories = await import("../directories.js");
    
    // Verify that mkdirSync was called for threads directory
    expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith("/test/home/.sage/threads");
    
    // Verify exported values
    expect(directories.sage).toBe("/test/home/.sage");
    expect(directories.config).toBe("/test/home/.sage/config.json");
    expect(directories.threads).toBe("/test/home/.sage/threads");
  });

  it("should not create directories if they already exist", async () => {
    // Mock homedir to return a test path
    vi.mocked(homedir).mockReturnValue("/test/home");
    
    // Mock existsSync to return true for all directories
    vi.mocked(existsSync).mockReturnValue(true);
    
    // Import the module after setting up mocks
    const directories = await import("../directories.js");
    
    // Verify that mkdirSync was not called
    expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
    
    // Verify exported values
    expect(directories.sage).toBe("/test/home/.sage");
    expect(directories.config).toBe("/test/home/.sage/config.json");
    expect(directories.threads).toBe("/test/home/.sage/threads");
  });
});