// Types for Agent Scenario DSL

import type { 
  TempWorkspace, 
  GraphAdapter, 
  ChronicleAdapter, 
  LLMClient, 
  ToolRegistry 
} from "../index.js";

// Core agent types matching SAGE specifications
export interface Plan {
  id: string;
  summary: string;
  steps: PlanStep[];
  metadata?: {
    goal?: string;
    filePath?: string;
    estimatedDuration?: number;
  };
}

export interface PlanStep {
  id: string;
  type: "read" | "write" | "edit" | "bash" | "query";
  description: string;
  tool: string;
  args: Record<string, any>;
  dependencies?: string[];
}

export interface Approve {
  type: "approve";
  justification: string;
  conditions?: string[];
}

export interface Deny {
  type: "deny";
  reason: string;
  suggestions?: string[];
}

export interface ExecutionReport {
  ok: boolean;
  planId: string;
  executedSteps: number;
  totalSteps: number;
  results?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    step?: string;
  };
  duration?: number;
}

// Agent interfaces (simplified for testing)
export interface Agent {
  id: string;
  type: "sage" | "guardian" | "delegator" | "warden" | "librarian" | "archivist";
}

export interface Guardian extends Agent {
  type: "guardian";
  filePath: string;
  reviewPlan(plan: Plan): Promise<Approve | Deny>;
  reconcile(edit: { filePath: string; diffRef: string }): Promise<{ ok: boolean }>;
}

export interface Delegator extends Agent {
  type: "delegator";
  execute(plan: Plan): Promise<ExecutionReport>;
}

export interface Sage extends Agent {
  type: "sage";
  ideate(input: { goal: string }): Promise<{ options: string[] }>;
  draftPlan(ideation: { options: string[]; goal?: string }): Promise<Plan>;
}

// Scenario dependencies container
export interface ScenarioContext {
  workspace: TempWorkspace;
  graph: GraphAdapter;
  chronicle: ChronicleAdapter;
  llm: LLMClient;
  tools: ToolRegistry;
  agents: Map<string, Agent>;
  clock: { now(): string };
}