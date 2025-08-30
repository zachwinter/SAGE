import { Operation, OperationConfig } from "../types/operations";
import { AgentRequest } from "../types/providers";
import { ExecutionContext } from "../types/context";
import { buildPromptFromBlocks } from "./prompt";

export function toAgentRequest(op: Operation, ctx: ExecutionContext): AgentRequest {
  const config: OperationConfig = op.config;

  // Input resolution
  const input = resolveInput(config.input, ctx);

  // Prompt block interpolation logic
  const prompt = buildPromptFromBlocks({
    role: config.role as string,
    task: config.task as string,
    input,
    schema: config.schema
  });

  console.log({
    model: config.model!,
    prompt,
    input,
    role: config.role,
    task: config.task,
    schema: config.schema,
    config: {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      role: config.role
    }
  });

  return {
    model: config.model!,
    prompt,
    input,
    role: config.role,
    task: config.task,
    schema: config.schema,
    config: {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      role: config.role
    }
  };
}

function resolveInput(
  input: string | string[] | undefined,
  ctx: ExecutionContext
): any {
  if (!input) return null;

  const getValue = (ref: string) => {
    if (ref.startsWith("$")) return ctx.variables[ref.slice(1)];
    return ctx.results[ref] ?? ref;
  };

  return Array.isArray(input) ? input.map(v => getValue(v)) : getValue(input);
}
