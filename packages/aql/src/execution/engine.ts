// Core execution engine for AQL queries

import {
  AgentRequest,
  AQLQuery,
  ExecutionContext,
  ExecutionError,
  ExecutionResult,
  Operation
} from "../types";
import { buildAgentPrompt } from "../utils/prompt";
import { parsePromptBlocks } from "../parser/prompt-parser";

export class ExecutionEngine {
  private context: ExecutionContext;

  constructor() {
    this.context = {
      variables: {},
      results: {},
      config: {
        timeout: 120000,
        retries: 3,
        parallel: true,
        caching: false,
        debug: false
      }
    };
  }

  async initialize(): Promise<void> {
    // Initialize execution engine
  }

  async execute(
    query: AQLQuery,
    variables: Record<string, any> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const errors: ExecutionError[] = [];

    try {
      // Set up execution context
      this.context.variables = { ...variables };
      this.context.results = {};

      if (this.context.config.debug) {
        console.log(`Executing query: ${query.name}`);
        console.log(`Variables:`, variables);
      }

      // Execute operations in dependency order
      await this.executeOperations(query.operations);

      const endTime = Date.now();

      return {
        query: query.name,
        results: { ...this.context.results },
        metadata: {
          totalTime: endTime - startTime,
          totalTokens: this.calculateTotalTokens(),
          operationsExecuted: Object.keys(this.context.results).length,
          errors
        }
      };
    } catch (error) {
      errors.push({
        operation: "query",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        recoverable: false
      });

      throw error;
    }
  }

  private async executeOperations(operations: Operation[]): Promise<void> {
    // Resolve execution order based on dependencies
    const orderedOps = this.resolveExecutionOrder(operations);

    // Execute operations in order
    for (const operation of orderedOps) {
      await this.executeSingleOperation(operation);
    }
  }

  private resolveExecutionOrder(operations: Operation[]): Operation[] {
    // Simple topological sort for dependency resolution
    const executed = new Set<string>();
    const executing = new Set<string>();
    const ordered: Operation[] = [];

    const executeOperation = (op: Operation): void => {
      if (executed.has(op.id)) return;
      if (executing.has(op.id)) {
        throw new Error(
          `Circular dependency detected involving operation: ${op.id}`
        );
      }

      executing.add(op.id);

      // Wait for dependencies
      for (const depId of op.dependencies) {
        const depOp = operations.find(o => o.id === depId);
        if (depOp) {
          executeOperation(depOp);
        }
      }

      executing.delete(op.id);
      executed.add(op.id);
      ordered.push(op);
    };

    // Execute all operations
    for (const operation of operations) {
      if (!executed.has(operation.id)) {
        executeOperation(operation);
      }
    }

    return ordered;
  }

  private async executeSingleOperation(operation: Operation): Promise<void> {
    if (this.context.config.debug) {
      console.log(`Executing operation: ${operation.id} (${operation.type})`);
    }

    switch (operation.type) {
      case "agent":
        await this.executeAgent(operation);
        break;
      case "parallel":
        await this.executeParallel(operation);
        break;
      case "sequential":
        await this.executeOperations(operation.config.operations || []);
        break;
      case "conditional":
        await this.executeConditional(operation);
        break;
      case "loop":
        await this.executeLoop(operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private resolveChainedInput(input: string | string[] | undefined): any {
    if (!input) return null;

    if (typeof input === "string") {
      // Chain reference
      if (this.context.results[input]) return this.context.results[input];
      // Variable reference
      if (input.startsWith("$")) return this.context.variables[input.slice(1)];
      return input;
    }

    if (Array.isArray(input)) return input.map(i => this.resolveChainedInput(i));
    return input;
  }

  private async executeAgent(operation: Operation): Promise<void> {
    const config = operation.config;
    const resolvedInput = this.resolveChainedInput(config.input);
    
    // Build prompt from configuration
    const agentRequest: AgentRequest = {
      model: config.model!,
      prompt: config.prompt,
      role: config.role,
      task: config.task,
      input: resolvedInput,
      schema: config.schema,
      config: {
        temperature: config.temperature,
        maxTokens: config.maxTokens
      }
    };

    const rawPrompt = buildAgentPrompt(agentRequest);
    const blocks = parsePromptBlocks(rawPrompt);

    // Inject resolved input into the INPUT block
    if (resolvedInput && !blocks.INPUT) {
      blocks.INPUT = String(resolvedInput);
    }

    // Validate required blocks
    const required = ["ROLE", "TASK"];
    for (const key of required) {
      if (!blocks[key]) throw new Error(`Missing required <${key}> block in prompt`);
    }

    // Reconstruct prompt
    const reservedOrder = ["ROLE", "SCHEMA", "TASK", "INPUT"];
    const ordered = reservedOrder
      .filter(key => blocks[key])
      .map(key => `<${key}>\n${blocks[key]}</${key}>`);

    const custom = Object.entries(blocks)
      .filter(([k]) => !reservedOrder.includes(k))
      .map(([k, v]) => `<${k}>\n${v}</${k}>`);

    const finalPrompt = [...ordered, ...custom].join("\n\n");

    // For now, we'll simulate agent execution with a placeholder response
    // In a real implementation, this would interface with an external agent system
    const resultKey = operation.name || operation.id;
    this.context.results[resultKey] = `Simulated response for operation: ${resultKey}`;

    if (this.context.config.debug) {
      console.log(`Operation ${operation.id} completed (simulated)`);
    }
  }

  private async executeParallel(operation: Operation): Promise<void> {
    if (!operation.config.operations) {
      throw new Error("Parallel operation requires operations array");
    }

    // Execute operations respecting dependencies
    await this.executeOperations(operation.config.operations);
  }

  private async executeConditional(operation: Operation): Promise<void> {
    // Simple condition evaluation - in a full implementation this would use a proper expression evaluator
    const condition = operation.config.condition!;
    const conditionResult = this.evaluateCondition(condition);

    if (conditionResult && operation.config.operations) {
      await this.executeOperations(operation.config.operations);
    }
  }

  private async executeLoop(operation: Operation): Promise<void> {
    const maxIterations = operation.config.iterations || 10;
    let iteration = 0;

    while (iteration < maxIterations) {
      if (operation.config.operations) {
        await this.executeOperations(operation.config.operations);
      }
      iteration++;

      // Simple exit condition - in full implementation would evaluate loop condition
      if (iteration >= maxIterations) break;
    }
  }

  private resolveInput(input: string | string[] | undefined): any {
    if (!input) return null;

    if (typeof input === "string") {
      // Check if it's a variable reference
      if (input.startsWith("$")) {
        const varName = input.slice(1);
        return this.context.variables[varName];
      }

      // Check if it's a result reference
      if (this.context.results[input]) {
        return this.context.results[input];
      }

      return input;
    }

    if (Array.isArray(input)) {
      return input.map(i => this.resolveInput(i));
    }

    return input;
  }

  // interpolatePrompt method is currently unused but kept for potential future use
  private interpolatePrompt(prompt: string, input: any): string {
    // Simple template interpolation - replace {{variable}} with values
    return prompt.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim();

      // Check variables first
      if (this.context.variables[trimmed]) {
        return String(this.context.variables[trimmed]);
      }

      // Check results
      if (this.context.results[trimmed]) {
        return String(this.context.results[trimmed]);
      }

      // Check if it's the input itself
      if (trimmed === "input" && input !== null) {
        return String(input);
      }

      // Return as-is if not found
      return match;
    });
  }

  private evaluateCondition(condition: string): boolean {
    // Placeholder for condition evaluation
    // In a full implementation, this would parse and evaluate expressions
    return true;
  }

  // detectDependencies method removed in favor of resolveExecutionOrder

  private calculateTotalTokens(): number {
    // Calculate total tokens used across all operations
    return Object.values(this.context.results).length * 100; // Placeholder
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration methods
  setDebug(debug: boolean): void {
    this.context.config.debug = debug;
  }

  setTimeout(timeout: number): void {
    this.context.config.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.context.config.retries = retries;
  }
}
