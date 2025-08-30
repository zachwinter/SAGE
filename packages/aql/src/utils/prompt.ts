import { AgentRequest } from "../types";

/**
 * Build full agent prompt from the config block-style structure.
 * Required blocks: ROLE, TASK. Optional: INPUT, SCHEMA.
 */
export function buildPromptFromBlocks(blocks: Record<string, string>): string {
  const required = ["ROLE", "TASK"];
  for (const key of required) {
    if (!blocks[key]) throw new Error(`Missing required <${key}> block in prompt`);
  }

  return Object.entries(blocks)
    .map(([key, val]) => `<${key}>\n${val}\n</${key}>`)
    .join("\n\n");
}

/**
 * High-level builder that takes full AgentRequest and returns the assembled prompt.
 * Explicit `prompt` wins. Otherwise, builds from block structure.
 */
export function buildAgentPrompt(config: AgentRequest): string {
  if (config.prompt) return config.prompt;

  const blocks: Record<string, string> = {
    ...(config.role && { ROLE: config.role }),
    ...(config.task && { TASK: config.task }),
    ...(config.input && { INPUT: config.input }),
    ...(config.schema && { SCHEMA: config.schema })
  };

  return buildPromptFromBlocks(blocks);
}
