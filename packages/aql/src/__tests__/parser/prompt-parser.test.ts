import { parsePromptBlocks } from "../../parser/prompt-parser";
import { describe, it, expect } from "vitest";

describe("parsePromptBlocks", () => {
  it("should parse basic prompt blocks", () => {
    const prompt = `<ROLE>
You are a helpful assistant
</ROLE>

<TASK>
Summarize the following text
</TASK>

<INPUT>
This is a long text that needs summarization.
</INPUT>`;

    const result = parsePromptBlocks(prompt);
    
    expect(result.ROLE).toBe("You are a helpful assistant");
    expect(result.TASK).toBe("Summarize the following text");
    expect(result.INPUT).toBe("This is a long text that needs summarization.");
  });

  it("should handle custom blocks", () => {
    const prompt = `<ROLE>
You are a helpful assistant
</ROLE>

<TASK>
Summarize the following text
</TASK>

<EXAMPLES>
Example 1: ...
Example 2: ...
</EXAMPLES>`;

    const result = parsePromptBlocks(prompt);
    
    expect(result.ROLE).toBe("You are a helpful assistant");
    expect(result.TASK).toBe("Summarize the following text");
    expect(result.EXAMPLES).toBe("Example 1: ...\nExample 2: ...");
  });

  it("should handle blocks with no newlines", () => {
    const prompt = `<ROLE>You are a helpful assistant</ROLE>
<TASK>Summarize the following text</TASK>`;

    const result = parsePromptBlocks(prompt);
    
    expect(result.ROLE).toBe("You are a helpful assistant");
    expect(result.TASK).toBe("Summarize the following text");
  });

  it("should handle empty blocks", () => {
    const prompt = `<ROLE>
</ROLE>

<TASK>
Summarize the following text
</TASK>`;

    const result = parsePromptBlocks(prompt);
    
    expect(result.ROLE).toBe("");
    expect(result.TASK).toBe("Summarize the following text");
  });
});