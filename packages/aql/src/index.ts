// Main exports for @aql/core package

export * from "./execution/engine";
export * from "./types";
export * from "./parser/simple-parser";
export { parsePromptBlocks } from "./parser/prompt-parser";

// Main AQL class for easy usage
import { ExecutionEngine } from "./execution/engine";
import { SimpleAQLParser } from "./parser/simple-parser";
import { AQLQuery } from "./types";

export class AQL {
  private engine: ExecutionEngine;
  private parser: SimpleAQLParser;

  constructor() {
    this.engine = new ExecutionEngine();
    this.parser = new SimpleAQLParser();
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  parseQuery(aqlSource: string): AQLQuery {
    return this.parser.parse(aqlSource);
  }

  async executeQuery(query: AQLQuery, variables: Record<string, any> = {}) {
    return await this.engine.execute(query, variables);
  }

  async run(aqlSource: string, variables: Record<string, any> = {}) {
    const query = this.parseQuery(aqlSource);
    return await this.executeQuery(query, variables);
  }

  setDebug(debug: boolean): void {
    this.engine.setDebug(debug);
  }

  setTimeout(timeout: number): void {
    this.engine.setTimeout(timeout);
  }

  setRetries(retries: number): void {
    this.engine.setRetries(retries);
  }
}
