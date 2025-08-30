type OperationResult = any;

interface ExecutionContext {
  results: Record<string, OperationResult>;
  get(name: string): OperationResult | undefined;
  set(name: string, result: OperationResult): void;
  interpolate(input: string): string;
}

export class DefaultExecutionContext implements ExecutionContext {
  results: Record<string, OperationResult> = {};

  get(name: string) {
    return this.results[name];
  }

  set(name: string, result: OperationResult) {
    this.results[name] = result;
  }

  interpolate(input: string): string {
    return input.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const val = this.results[key.trim()];
      return typeof val === "string" ? val : JSON.stringify(val);
    });
  }
}

import { Operation } from "../types";

export function resolveExecutionOrder(operations: Operation[]): string[] {
  const graph: Record<string, Set<string>> = {};
  const visited = new Set<string>();
  const result: string[] = [];

  // Detect dependencies via $refs or {{interpolations}}
  const getDeps = (op: Operation): string[] => {
    const deps = new Set<string>();
    const visitValue = (v: any) => {
      if (typeof v === "string") {
        const direct = v.match(/^\$(\w+)/);
        const interpolated = [...v.matchAll(/\{\{(.*?)\}\}/g)];
        if (direct) deps.add(direct[1]);
        for (const match of interpolated) deps.add(match[1].trim());
      } else if (typeof v === "object" && v !== null) {
        Object.values(v).forEach(visitValue);
      }
    };
    visitValue(op);
    return Array.from(deps);
  };

  for (const op of operations) {
    graph[op.name || op.id] = new Set(getDeps(op));
  }

  const tempMark = new Set<string>();
  function visit(name: string) {
    if (tempMark.has(name)) {
      throw new Error(`Cyclic dependency involving "${name}"`);
    }
    if (!visited.has(name)) {
      tempMark.add(name);
      for (const dep of graph[name] || []) {
        visit(dep);
      }
      tempMark.delete(name);
      visited.add(name);
      result.push(name);
    }
  }

  for (const name of Object.keys(graph)) {
    visit(name);
  }

  return result;
}
