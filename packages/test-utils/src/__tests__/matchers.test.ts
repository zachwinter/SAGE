import { describe, it, expect, beforeEach } from "vitest";
import { 
  createTempWorkspace,
  makeChronicle,
  makeGraphAdapter,
  toEqualDir,
  toContainEvent,
  toBeCommitAddressable,
  toRespectTransactionBoundary,
  setupMatchers
} from "../index.js";
import {
  toHaltOnContradiction,
  toStampUnsafe,
  toReconcileChanges,
  toMaintainCausalChain
} from "../matchers/matchers.js";

// Set up custom matchers
setupMatchers();

describe("Story 4: Protocol Matchers & Assertions", () => {
  describe("toEqualDir matcher", () => {
    it("passes when directory structures match exactly", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/App.ts", "export const App = () => {};");
      await ws.file("package.json", '{"name": "test"}');
      
      const result = await toEqualDir(ws, {
        "src/App.ts": "export const App = () => {};",
        "package.json": '{"name": "test"}'
      });
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("match exactly");
    });

    it("fails when files are missing", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/App.ts", "export const App = () => {};");
      
      const result = await toEqualDir(ws, {
        "src/App.ts": "export const App = () => {};",
        "src/Utils.ts": "export const utils = {};"
      });
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Missing files: src/Utils.ts");
    });

    it("fails when extra files exist", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/App.ts", "export const App = () => {};");
      await ws.file("src/Extra.ts", "// extra");
      
      const result = await toEqualDir(ws, {
        "src/App.ts": "export const App = () => {};"
      });
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Unexpected files: src/Extra.ts");
    });

    it("fails when file content differs", async () => {
      const ws = await createTempWorkspace();
      await ws.file("src/App.ts", "export const App = () => 'actual';");
      
      const result = await toEqualDir(ws, {
        "src/App.ts": "export const App = () => 'expected';"
      });
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Content differs: src/App.ts");
      expect(result.message()).toContain("--- expected/src/App.ts");
      expect(result.message()).toContain("+++ actual/src/App.ts");
    });

    it("handles workspace read errors gracefully", async () => {
      const mockWorkspace = {
        root: "/tmp/test",
        tree: async () => {
          throw new Error("Permission denied");
        }
      } as any;
      
      const result = await toEqualDir(mockWorkspace, {});
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Failed to compare directories");
      expect(result.message()).toContain("Permission denied");
    });

    it("works with extended expect interface", async () => {
      const ws = await createTempWorkspace();
      await ws.file("test.txt", "content");
      
      // This should work with the extended interface
      await expect(ws).toEqualDir({
        "test.txt": "content"
      });
    });
  });

  describe("toContainEvent matcher", () => {
    it("passes when matching event is found", () => {
      const events = [
        {
          type: "PLAN_APPROVED", 
          planId: "plan-123",
          timestamp: "2025-01-01T00:00:00Z",
          actor: { agent: "guardian", id: "src/test.ts" }
        },
        {
          type: "PLAN_EXECUTED",
          planId: "plan-123", 
          timestamp: "2025-01-01T00:01:00Z"
        }
      ];
      
      const result = toContainEvent(events, {
        type: "PLAN_APPROVED",
        planId: "plan-123"
      });
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("Found matching event");
    });

    it("supports nested actor matching", () => {
      const events = [
        {
          type: "RECONCILIATION",
          actor: { agent: "guardian", id: "src/test.ts" },
          filePath: "src/test.ts"
        }
      ];
      
      const result = toContainEvent(events, {
        type: "RECONCILIATION", 
        actor: { agent: "guardian" }
      });
      
      expect(result.pass).toBe(true);
    });

    it("fails when no matching event exists", () => {
      const events = [
        { type: "PLAN_APPROVED", planId: "plan-123" },
        { type: "PLAN_EXECUTED", planId: "plan-456" }
      ];
      
      const result = toContainEvent(events, {
        type: "PLAN_DENIED",
        planId: "plan-123"
      });
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Expected to find event matching");
      expect(result.message()).toContain("PLAN_DENIED");
    });

    it("works with extended expect interface", async () => {
      const chronicle = makeChronicle();
      await chronicle.append("test.sage", {
        type: "TEST_EVENT",
        data: "test"
      });
      
      const events = await chronicle.read("test.sage");
      expect(events).toContainEvent({ type: "TEST_EVENT" });
    });
  });

  describe("toBeCommitAddressable matcher", () => {
    it("passes for valid single node", () => {
      const node = {
        id: "node-1",
        labels: ["Function"],
        properties: { name: "testFunc", filePath: "src/test.ts" },
        first_seen: "abc123",
        last_seen: "def456"
      };
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("properly commit-addressable");
    });

    it("passes for valid node array", () => {
      const nodes = [
        {
          id: "file-1", 
          labels: ["File"],
          properties: { path: "src/test.ts" },
          first_seen: "abc123"
        },
        {
          id: "fn-1",
          labels: ["Function"],  
          properties: { name: "test", filePath: "src/test.ts" },
          first_seen: "abc123"
        }
      ];
      
      const result = toBeCommitAddressable(nodes);
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("2 node(s) are properly");
    });

    it("fails for node missing id", () => {
      const node = {
        labels: ["Function"],
        properties: { name: "test" },
        first_seen: "abc123"
      } as any;
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("missing required 'id' field");
    });

    it("fails for node missing first_seen", () => {
      const node = {
        id: "node-1",
        labels: ["Function"],
        properties: { name: "test" }
      } as any;
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("missing 'first_seen' commit field");
    });

    it("fails for invalid commit format", () => {
      const node = {
        id: "node-1",
        labels: ["Function"],
        properties: { name: "test" },
        first_seen: "invalid-commit-hash!"
      };
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("invalid 'first_seen' format");
    });

    it("fails for incorrect commit ordering", () => {
      const node = {
        id: "node-1", 
        labels: ["Function"],
        properties: { name: "test" },
        first_seen: "def456",
        last_seen: "abc123" // Earlier than first_seen
      };
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("invalid commit ordering");
    });

    it("fails for File node missing path property", () => {
      const node = {
        id: "file-1",
        labels: ["File"],
        properties: { /* missing path */ },
        first_seen: "abc123"
      };
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("File node file-1 missing 'path' property");
    });

    it("fails for Function node missing name property", () => {
      const node = {
        id: "fn-1",
        labels: ["Function"],
        properties: { filePath: "src/test.ts" /* missing name */ },
        first_seen: "abc123"
      };
      
      const result = toBeCommitAddressable(node);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Function node fn-1 missing 'name' property");
    });
  });

  describe("toRespectTransactionBoundary matcher", () => {
    it("passes for proper transaction behavior", () => {
      const state = {
        stagingDir: "/tmp/staging",
        productionDir: "/tmp/production",
        operations: [
          {
            type: "read" as const,
            path: "/tmp/production/input.ts",
            timestamp: "2025-01-01T00:00:00Z"
          },
          {
            type: "write" as const,
            path: "/tmp/staging/output.ts",  
            timestamp: "2025-01-01T00:01:00Z"
          },
          {
            type: "delete" as const,
            path: "/tmp/staging/.tmp123",
            timestamp: "2025-01-01T00:02:00Z"
          }
        ]
      };
      
      const result = toRespectTransactionBoundary(state);
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("properly respected");
    });

    it("fails for writes outside staging area", () => {
      const state = {
        stagingDir: "/tmp/staging",
        productionDir: "/tmp/production", 
        operations: [
          {
            type: "write" as const,
            path: "/tmp/production/bad.ts", // Direct production write
            timestamp: "2025-01-01T00:00:00Z"
          }
        ]
      };
      
      const result = toRespectTransactionBoundary(state);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("write operations outside staging area");
      expect(result.message()).toContain("/tmp/production/bad.ts");
    });

    it("fails for reads after writes", () => {
      const state = {
        stagingDir: "/tmp/staging",
        productionDir: "/tmp/production",
        operations: [
          {
            type: "write" as const,
            path: "/tmp/staging/output.ts",
            timestamp: "2025-01-01T00:00:00Z"
          },
          {
            type: "read" as const,
            path: "/tmp/production/input.ts", // Read after write
            timestamp: "2025-01-01T00:01:00Z"
          }
        ]
      };
      
      const result = toRespectTransactionBoundary(state);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Read operation after write detected");
    });

    it("fails for unclean temporary files", () => {
      const state = {
        stagingDir: "/tmp/staging",
        productionDir: "/tmp/production",
        operations: [
          {
            type: "write" as const,
            path: "/tmp/staging/.tmp123", // Temp file created but never deleted
            timestamp: "2025-01-01T00:00:00Z"  
          }
        ]
      };
      
      const result = toRespectTransactionBoundary(state);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Temporary files not cleaned up");
      expect(result.message()).toContain(".tmp123");
    });
  });

  describe("Protocol-specific matchers", () => {
    it("toHaltOnContradiction passes when halt event exists", () => {
      const events = [
        { type: "PLAN_APPROVED", planId: "plan-1" },
        { type: "HALT_AND_REPORT", invariant: "Graph/Chronicle contradiction detected" }
      ];
      
      const result = toHaltOnContradiction(events);
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("properly halted on contradiction");
    });

    it("toHaltOnContradiction fails when no halt event", () => {
      const events = [
        { type: "PLAN_APPROVED", planId: "plan-1" },
        { type: "PLAN_EXECUTED", planId: "plan-1" }
      ];
      
      const result = toHaltOnContradiction(events);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Expected HALT_AND_REPORT event but none found");
    });

    it("toStampUnsafe passes when unsafe events exist", () => {
      const events = [
        { type: "PLAN_DRAFTED", planId: "plan-1" },
        { type: "PLAN_UNSAFE", planId: "plan-1", reason: "Denied plan executed anyway" }
      ];
      
      const result = toStampUnsafe(events, "plan-1");
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("Plan plan-1 properly stamped as unsafe");
    });

    it("toStampUnsafe fails when specific plan not stamped", () => {
      const events = [
        { type: "PLAN_UNSAFE", planId: "plan-2" }
      ];
      
      const result = toStampUnsafe(events, "plan-1");
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Plan plan-1 not stamped as unsafe");
    });

    it("toReconcileChanges passes for proper reconciliation flow", () => {
      const events = [
        { 
          type: "ROGUE_EDIT_DETECTED", 
          filePath: "src/test.ts",
          timestamp: "2025-01-01T00:00:00Z"
        },
        { 
          type: "RECONCILIATION",
          filePath: "src/test.ts", 
          timestamp: "2025-01-01T00:01:00Z"
        }
      ];
      
      const result = toReconcileChanges(events, "src/test.ts");
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("properly reconciled after rogue edit detection");
    });

    it("toReconcileChanges fails for incorrect event ordering", () => {
      const events = [
        {
          type: "RECONCILIATION",
          filePath: "src/test.ts",
          timestamp: "2025-01-01T00:00:00Z"
        },
        { 
          type: "ROGUE_EDIT_DETECTED",
          filePath: "src/test.ts", 
          timestamp: "2025-01-01T00:01:00Z" 
        }
      ];
      
      const result = toReconcileChanges(events, "src/test.ts");
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Reconciliation event occurred before rogue edit detection");
    });

    it("toMaintainCausalChain passes for properly ordered events", () => {
      const events = [
        {
          type: "EVENT_A",
          eventId: "event1", 
          timestamp: "2025-01-01T00:00:00Z"
        },
        {
          type: "EVENT_B",
          eventId: "event2",
          timestamp: "2025-01-01T00:01:00Z",
          prevEventId: "event1"
        },
        {
          type: "EVENT_C", 
          eventId: "event3",
          timestamp: "2025-01-01T00:02:00Z",
          prevEventId: "event2"
        }
      ];
      
      const result = toMaintainCausalChain(events);
      
      expect(result.pass).toBe(true);
      expect(result.message()).toContain("Causal chain properly maintained");
    });

    it("toMaintainCausalChain fails for timestamp ordering violations", () => {
      const events = [
        {
          type: "EVENT_A",
          eventId: "event1",
          timestamp: "2025-01-01T00:02:00Z" // Later timestamp
        },
        {
          type: "EVENT_B", 
          eventId: "event2",
          timestamp: "2025-01-01T00:01:00Z" // Earlier timestamp
        }
      ];
      
      const result = toMaintainCausalChain(events);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("timestamp earlier than previous event");
    });

    it("toMaintainCausalChain fails for incorrect prevEventId", () => {
      const events = [
        {
          type: "EVENT_A",
          eventId: "event1",
          timestamp: "2025-01-01T00:00:00Z"
        },
        {
          type: "EVENT_B",
          eventId: "event2", 
          timestamp: "2025-01-01T00:01:00Z",
          prevEventId: "wrongEventId" // Should be "event1"
        }
      ];
      
      const result = toMaintainCausalChain(events);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("incorrect prevEventId reference");
    });

    it("toMaintainCausalChain fails for duplicate eventIds", () => {
      const events = [
        { type: "EVENT_A", eventId: "duplicate", timestamp: "2025-01-01T00:00:00Z" },
        { type: "EVENT_B", eventId: "duplicate", timestamp: "2025-01-01T00:01:00Z" }
      ];
      
      const result = toMaintainCausalChain(events);
      
      expect(result.pass).toBe(false);
      expect(result.message()).toContain("Found duplicate eventIds");
    });
  });

  describe("Integration with real adapters", () => {
    it("works with Chronicle adapter", async () => {
      const chronicle = makeChronicle();
      
      await chronicle.append("test.sage", {
        type: "PLAN_APPROVED",
        planId: "plan-123"
      });
      
      const events = await chronicle.read("test.sage");
      const result = toContainEvent(events, { type: "PLAN_APPROVED" });
      
      expect(result.pass).toBe(true);
    });

    it("works with Graph adapter", async () => {
      const graph = makeGraphAdapter() as any;
      
      await graph.ingest({
        file: "src/test.ts",
        defines: ["testFunc"],
        commit: "abc123"
      });
      
      const nodes = graph.getAllNodes();
      const functionNodes = nodes.filter((n: any) => n.labels.includes("Function"));
      
      const result = toBeCommitAddressable(functionNodes);
      expect(result.pass).toBe(true);
    });

    it("creates realistic transaction boundary scenarios", async () => {
      const state = {
        stagingDir: "/tmp/staging",
        productionDir: "/tmp/production",
        operations: [
          // Proper flow: read from production, write to staging
          { type: "read" as const, path: "/tmp/production/src/App.ts", timestamp: "2025-01-01T00:00:00Z" },
          { type: "write" as const, path: "/tmp/staging/src/App.ts", timestamp: "2025-01-01T00:01:00Z" },
          { type: "write" as const, path: "/tmp/staging/dist/App.js", timestamp: "2025-01-01T00:02:00Z" },
          // Clean up temp files
          { type: "delete" as const, path: "/tmp/staging/.build.tmp", timestamp: "2025-01-01T00:03:00Z" }
        ]
      };
      
      const result = toRespectTransactionBoundary(state);
      expect(result.pass).toBe(true);
    });
  });
});