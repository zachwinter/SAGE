import { describe, it, expect } from "vitest";
import { getContextLines } from "../parser-utils.js";

describe("parser-utils", () => {
  describe("getContextLines", () => {
    const sampleLines = [
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5",
      "line 6",
      "line 7"
    ];

    it("should return empty array when contextSize is 0", () => {
      const result = getContextLines(sampleLines, 3, 0);
      expect(result).toEqual([]);
    });

    it("should return empty array when contextSize is undefined", () => {
      const result = getContextLines(sampleLines, 3, undefined as any);
      expect(result).toEqual([]);
    });

    it("should return context lines around target line", () => {
      const result = getContextLines(sampleLines, 4, 1);

      expect(result).toHaveLength(2); // 1 before + 1 after (excluding target line)
      expect(result).toEqual([
        { number: 3, content: "line 3" },
        { number: 5, content: "line 5" }
      ]);
    });

    it("should return larger context when requested", () => {
      const result = getContextLines(sampleLines, 4, 2);

      expect(result).toHaveLength(4); // 2 before + 2 after (excluding target line)
      expect(result).toEqual([
        { number: 2, content: "line 2" },
        { number: 3, content: "line 3" },
        { number: 5, content: "line 5" },
        { number: 6, content: "line 6" }
      ]);
    });

    it("should handle context at beginning of file", () => {
      const result = getContextLines(sampleLines, 1, 2);

      // Should only return lines after (no lines before line 1)
      expect(result).toEqual([
        { number: 2, content: "line 2" },
        { number: 3, content: "line 3" }
      ]);
    });

    it("should handle context at end of file", () => {
      const result = getContextLines(sampleLines, 7, 2);

      // Should only return lines before (no lines after line 7)
      expect(result).toEqual([
        { number: 5, content: "line 5" },
        { number: 6, content: "line 6" }
      ]);
    });

    it("should handle context larger than file", () => {
      const shortLines = ["line 1", "line 2", "line 3"];
      const result = getContextLines(shortLines, 2, 10);

      // Should return all available context
      expect(result).toEqual([
        { number: 1, content: "line 1" },
        { number: 3, content: "line 3" }
      ]);
    });

    it("should exclude the target line itself", () => {
      const result = getContextLines(sampleLines, 4, 3);

      // Should not include line 4 (target line) in the result
      const lineNumbers = result.map(line => line.number);
      expect(lineNumbers).not.toContain(4);
    });

    it("should handle single line file", () => {
      const singleLine = ["only line"];
      const result = getContextLines(singleLine, 1, 2);

      expect(result).toEqual([]); // No context available
    });

    it("should handle empty file", () => {
      const emptyLines: string[] = [];
      const result = getContextLines(emptyLines, 1, 2);

      expect(result).toEqual([]);
    });

    it("should preserve original line content including whitespace", () => {
      const linesWithWhitespace = [
        "",
        "  indented line",
        "\tline with tab",
        "  ",
        "normal line"
      ];

      const result = getContextLines(linesWithWhitespace, 3, 2);

      expect(result).toEqual([
        { number: 1, content: "" },
        { number: 2, content: "  indented line" },
        { number: 4, content: "  " },
        { number: 5, content: "normal line" }
      ]);
    });

    it("should handle line numbers correctly (1-indexed)", () => {
      const result = getContextLines(sampleLines, 3, 1);

      expect(result[0].number).toBe(2); // Line before target (3)
      expect(result[1].number).toBe(4); // Line after target (3)
    });
  });
});
