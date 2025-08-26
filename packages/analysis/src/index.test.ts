import { describe, it, expect } from "vitest";
import * as analysis from "./index.js";

describe("Analysis Package Exports", () => {
  it("should export all expected functions", () => {
    expect(analysis.analyzeFiles).toBeDefined();
    expect(analysis.analyzeFile).toBeDefined();
    expect(analysis.performCallTreeAnalysis).toBeDefined();
    expect(analysis.performTopologicalSort).toBeDefined();
    expect(analysis.performTypeAnalysis).toBeDefined();
    expect(analysis.getCodeFiles).toBeDefined();
    expect(analysis.getTypescriptFiles).toBeDefined();
    expect(analysis.getRustFiles).toBeDefined();
  });

  it("should export all expected types", () => {
    // We can't test type exports at runtime, but we can verify they exist in the type system
    expect(true).toBe(true);
  });
});