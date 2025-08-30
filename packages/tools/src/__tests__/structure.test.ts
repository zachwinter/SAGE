import { describe, it, expect } from "vitest";

describe("Tools Package Structure", () => {
  it("should have proper exports", async () => {
    // This test just verifies that the package can be imported without errors
    const toolsModule = await import("../index.js");
    
    expect(toolsModule).toBeDefined();
    expect(typeof toolsModule).toBe("object");
  });

  it("should export expected functions", async () => {
    const { Read, Write, Edit, Bash, GraphQuery, toolRegistry } = await import("../index.js");
    
    expect(Read).toBeDefined();
    expect(Write).toBeDefined();
    expect(Edit).toBeDefined();
    expect(Bash).toBeDefined();
    expect(GraphQuery).toBeDefined();
    expect(toolRegistry).toBeDefined();
  });

  it("should be able to create tools", async () => {
    const { Read, Write, Edit, Bash } = await import("../index.js");
    
    // These should be factory functions
    expect(typeof Read).toBe("function");
    expect(typeof Write).toBe("function");
    expect(typeof Edit).toBe("function");
    expect(typeof Bash).toBe("function");
  });
});