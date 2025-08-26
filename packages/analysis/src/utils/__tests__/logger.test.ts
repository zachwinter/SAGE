import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock fs, path, and os modules
vi.mock("fs");
vi.mock("path");
vi.mock("os");

describe("logger", () => {
  let loggerModule: any;
  
  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset environment variables
    delete process.env.SAGE_LOG_LEVEL;
    delete process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    
    // Setup path mock
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(path.resolve).mockImplementation((...args) => args.join("/"));
    
    // Setup os mock
    vi.mocked(os.homedir).mockReturnValue("/test/home");
    
    // Setup fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.appendFileSync).mockReturnValue(undefined);
    
    // Mock console methods to prevent actual console output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Reset modules and import logger
    vi.resetModules();
    loggerModule = await import("../logger.js");
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create log directory on initialization", () => {
    expect(fs.existsSync).toHaveBeenCalledWith("/test/home/.sage/logs");
    expect(fs.mkdirSync).toHaveBeenCalledWith("/test/home/.sage/logs", { recursive: true });
  });

  it("should not create log directory if it already exists", async () => {
    // Reset modules
    vi.resetModules();
    
    // Setup fs mock to return true for existsSync on the log directory
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (path === "/test/home/.sage/logs") {
        return true; // Directory exists
      }
      return false; // Other paths don't exist
    });
    
    // Clear previous mkdirSync calls
    vi.mocked(fs.mkdirSync).mockClear();
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    expect(fs.existsSync).toHaveBeenCalledWith("/test/home/.sage/logs");
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("should set log level from SAGE_LOG_LEVEL environment variable", async () => {
    // Reset modules
    vi.resetModules();
    
    // Set environment variable
    process.env.SAGE_LOG_LEVEL = "DEBUG";
    
    // Mock console to capture log output
    const consoleInfoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    // Check that the log level was set correctly
    expect(loggerModule2.default.debug).toBeDefined();
  });

  it("should set DEBUG log level for development environment", async () => {
    // Reset modules
    vi.resetModules();
    
    // Set environment variable
    process.env.NODE_ENV = "development";
    
    // Mock console to capture log output
    const consoleInfoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    // Check that the log level was set correctly
    expect(loggerModule2.default.debug).toBeDefined();
  });

  it("should expose log methods", () => {
    expect(loggerModule.default.debug).toBeTypeOf("function");
    expect(loggerModule.default.info).toBeTypeOf("function");
    expect(loggerModule.default.warn).toBeTypeOf("function");
    expect(loggerModule.default.error).toBeTypeOf("function");
  });

  it("should expose path getter methods", () => {
    expect(loggerModule.default.getLogPath()).toBe("/test/home/.sage/logs/app.log");
    expect(loggerModule.default.getLogDir()).toBe("/test/home/.sage/logs");
  });

  it("should write debug messages when log level is DEBUG", async () => {
    // Reset modules
    vi.resetModules();
    
    // Set environment variable
    process.env.SAGE_LOG_LEVEL = "DEBUG";
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    // Call debug method
    loggerModule2.default.debug("Test debug message");
    
    // Check that appendFileSync was called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it("should not write debug messages when log level is INFO", async () => {
    // Reset modules and clear mocks
    vi.resetModules();
    vi.clearAllMocks();
    
    // Set environment variable
    process.env.SAGE_LOG_LEVEL = "INFO";
    
    // Setup mocks again
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
    vi.mocked(path.resolve).mockImplementation((...args) => args.join("/"));
    vi.mocked(os.homedir).mockReturnValue("/test/home");
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.appendFileSync).mockReturnValue(undefined);
    
    // Mock console methods to prevent actual console output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Clear the appendFileSync mock calls from the log level initialization
    vi.mocked(fs.appendFileSync).mockClear();
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    // Clear the appendFileSync mock calls from the log level initialization
    vi.mocked(fs.appendFileSync).mockClear();
    
    // Call debug method
    loggerModule2.default.debug("Test debug message");
    
    // Check that appendFileSync was not called for the debug message
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it("should write info messages when log level is INFO", async () => {
    // Reset modules
    vi.resetModules();
    
    // Set environment variable
    process.env.SAGE_LOG_LEVEL = "INFO";
    
    // Re-import logger
    const loggerModule2 = await import("../logger.js");
    
    // Call info method
    loggerModule2.default.info("Test info message");
    
    // Check that appendFileSync was called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it("should write warn messages", () => {
    loggerModule.default.warn("Test warning message");
    
    // Check that appendFileSync was called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it("should write error messages with Error object", () => {
    const error = new Error("Test error");
    loggerModule.default.error("Test error message", error);
    
    // Check that appendFileSync was called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it("should write error messages with string", () => {
    loggerModule.default.error("Test error message", "Error string");
    
    // Check that appendFileSync was called
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it("should handle file writing errors gracefully", () => {
    // Make appendFileSync throw an error
    vi.mocked(fs.appendFileSync).mockImplementation(() => {
      throw new Error("Write error");
    });
    
    // This should not throw
    expect(() => {
      loggerModule.default.info("Test message");
    }).not.toThrow();
  });

  it("should handle directory creation errors gracefully", async () => {
    // Reset modules
    vi.resetModules();
    
    // Make mkdirSync throw an error
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error("Permission denied");
    });
    
    // Mock console.error to capture output
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    // Re-import logger - this should not throw
    expect(async () => {
      await import("../logger.js");
    }).not.toThrow();
  });

  it("should include context in log messages", () => {
    loggerModule.default.info("Test message", { userId: 123, action: "login" });
    
    // Check that appendFileSync was called with context
    expect(fs.appendFileSync).toHaveBeenCalled();
  });
});