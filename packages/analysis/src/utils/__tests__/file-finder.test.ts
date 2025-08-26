import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTypescriptFiles, getRustFiles, getCodeFiles } from "../file-finder.js";

// Mock glob module
vi.mock("glob", () => ({
  glob: {
    sync: vi.fn()
  }
}));

// Import glob to access the mocked version
import { glob } from "glob";

describe("file-finder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTypescriptFiles", () => {
    it("should call glob with correct pattern and ignore options", () => {
      const mockFiles = ["/test/src/main.ts", "/test/src/utils/helpers.ts"];
      vi.mocked(glob.sync).mockReturnValue(mockFiles);
      
      const result = getTypescriptFiles("/test");
      
      expect(result).toEqual(mockFiles);
      expect(vi.mocked(glob.sync)).toHaveBeenCalledWith(
        "/test/**/*.{ts,tsx,js,jsx,mts,cts}",
        {
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**",
            "**/[A-Z]*/**"
          ]
        }
      );
    });

    it("should return empty array when no files match", () => {
      vi.mocked(glob.sync).mockReturnValue([]);
      
      const result = getTypescriptFiles("/empty");
      
      expect(result).toEqual([]);
    });
  });

  describe("getRustFiles", () => {
    it("should call glob with correct pattern and ignore options", () => {
      const mockFiles = ["/test/src/main.rs", "/test/src/utils/helpers.rs"];
      vi.mocked(glob.sync).mockReturnValue(mockFiles);
      
      const result = getRustFiles("/test");
      
      expect(result).toEqual(mockFiles);
      expect(vi.mocked(glob.sync)).toHaveBeenCalledWith(
        "/test/**/*.rs",
        {
          ignore: [
            "**/target/**",
            "**/.git/**",
            "**/[A-Z]*/**"
          ]
        }
      );
    });

    it("should return empty array when no files match", () => {
      vi.mocked(glob.sync).mockReturnValue([]);
      
      const result = getRustFiles("/empty");
      
      expect(result).toEqual([]);
    });
  });

  describe("getCodeFiles", () => {
    it("should call glob for both TypeScript and Rust files", () => {
      const mockTsFiles = ["/test/src/main.ts", "/test/src/utils/helpers.ts"];
      const mockRustFiles = ["/test/src/main.rs", "/test/src/utils/helpers.rs"];
      
      // Mock glob.sync to return different values based on the pattern
      vi.mocked(glob.sync).mockImplementation((pattern) => {
        if (pattern.includes(".{js,jsx,ts,tsx,mts,cts}")) {
          return mockTsFiles;
        } else if (pattern.includes(".rs")) {
          return mockRustFiles;
        }
        return [];
      });
      
      const result = getCodeFiles("/test");
      
      expect(result).toEqual([...mockTsFiles, ...mockRustFiles]);
      
      // Check that glob.sync was called twice
      expect(vi.mocked(glob.sync)).toHaveBeenCalledTimes(2);
      
      // Check first call for TypeScript files
      expect(vi.mocked(glob.sync)).toHaveBeenNthCalledWith(
        1,
        "/test/**/*.{js,jsx,ts,tsx,mts,cts}",
        {
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**"
          ]
        }
      );
      
      // Check second call for Rust files
      expect(vi.mocked(glob.sync)).toHaveBeenNthCalledWith(
        2,
        "/test/**/*.rs",
        {
          ignore: [
            "**/target/**",
            "**/.git/**"
          ]
        }
      );
    });

    it("should return only TypeScript files when no Rust files exist", () => {
      const mockTsFiles = ["/test/src/main.ts"];
      const mockRustFiles: string[] = [];
      
      // Mock glob.sync to return different values based on the pattern
      vi.mocked(glob.sync).mockImplementation((pattern) => {
        if (pattern.includes(".{js,jsx,ts,tsx,mts,cts}")) {
          return mockTsFiles;
        } else if (pattern.includes(".rs")) {
          return mockRustFiles;
        }
        return [];
      });
      
      const result = getCodeFiles("/test");
      
      expect(result).toEqual(mockTsFiles);
    });

    it("should return only Rust files when no TypeScript files exist", () => {
      const mockTsFiles: string[] = [];
      const mockRustFiles = ["/test/src/main.rs"];
      
      // Mock glob.sync to return different values based on the pattern
      vi.mocked(glob.sync).mockImplementation((pattern) => {
        if (pattern.includes(".{js,jsx,ts,tsx,mts,cts}")) {
          return mockTsFiles;
        } else if (pattern.includes(".rs")) {
          return mockRustFiles;
        }
        return [];
      });
      
      const result = getCodeFiles("/test");
      
      expect(result).toEqual(mockRustFiles);
    });

    it("should return empty array when no files match", () => {
      vi.mocked(glob.sync).mockReturnValue([]);
      
      const result = getCodeFiles("/empty");
      
      expect(result).toEqual([]);
    });
  });
});