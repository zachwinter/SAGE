import { expect } from "vitest";
import type { 
  DirectoryStructure,
  EventPattern,
  GraphNode,
  TransactionState
} from "./types.js";
import {
  toEqualDir,
  toContainEvent,
  toBeCommitAddressable,
  toRespectTransactionBoundary,
  toHaltOnContradiction,
  toStampUnsafe,
  toReconcileChanges,
  toMaintainCausalChain
} from "./matchers.js";

// Extend Vitest's expect interface with custom matchers
interface CustomMatchers<R = unknown> {
  toEqualDir(expected: DirectoryStructure): Promise<R>;
  toContainEvent(pattern: EventPattern): R;
  toBeCommitAddressable(): R;
  toRespectTransactionBoundary(): R;
  toHaltOnContradiction(): R;
  toStampUnsafe(planId?: string): R;
  toReconcileChanges(filePath?: string): R;
  toMaintainCausalChain(): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

/**
 * Set up custom matchers for SAGE protocol testing
 * Call this in your test setup file
 */
export function setupMatchers(): void {
  // Directory structure matcher
  expect.extend({
    async toEqualDir(workspace, expected: DirectoryStructure) {
      return await toEqualDir(workspace, expected);
    }
  });

  // Chronicle event matchers
  expect.extend({
    toContainEvent(events: any[], pattern: EventPattern) {
      return toContainEvent(events, pattern);
    },
    
    toHaltOnContradiction(events: any[]) {
      return toHaltOnContradiction(events);
    },
    
    toStampUnsafe(events: any[], planId?: string) {
      return toStampUnsafe(events, planId);
    },
    
    toReconcileChanges(events: any[], filePath?: string) {
      return toReconcileChanges(events, filePath);
    },
    
    toMaintainCausalChain(events: any[]) {
      return toMaintainCausalChain(events);
    }
  });

  // Graph node matchers
  expect.extend({
    toBeCommitAddressable(nodes: GraphNode | GraphNode[]) {
      return toBeCommitAddressable(nodes);
    }
  });

  // Transaction boundary matchers
  expect.extend({
    toRespectTransactionBoundary(state: TransactionState) {
      return toRespectTransactionBoundary(state);
    }
  });
}