// Utility functions for parsing prompt blocks

/**
 * Parse prompt blocks from a prompt string.
 * Extracts content between XML-style tags (e.g., <ROLE>...</ROLE>)
 * and returns a record of tag names to content.
 * 
 * @param prompt The prompt string to parse
 * @returns A record of tag names to content
 */
export function parsePromptBlocks(prompt: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  const regex = /<(\w+)>\n?([\s\S]*?)<\/\1>/g;
  let match;

  while ((match = regex.exec(prompt)) !== null) {
    const [_, tag, content] = match;
    blocks[tag.toUpperCase()] = content.trim();
  }

  return blocks;
}