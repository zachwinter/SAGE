import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTypescriptFiles } from "../file-finder.js";

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
        "/test/**/*.{ts,tsx,mts,cts}",
        {
          ignore: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/coverage/**",
            "**/*.d.ts"
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
});
