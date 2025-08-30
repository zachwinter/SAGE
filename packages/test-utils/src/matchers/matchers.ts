import type {
  MatcherResult,
  DirectoryStructure,
  EventPattern,
  GraphNode,
  TransactionState,
  DirectoryMatcher,
  ChronicleEventMatcher,
  GraphNodeMatcher,
  TransactionMatcher
} from "./types.js";
import type { TempWorkspace } from "../index.js";

/**
 * Directory structure matcher - compares workspace tree to expected structure
 */
export const toEqualDir: DirectoryMatcher = async (
  workspace: TempWorkspace,
  expected: DirectoryStructure
): Promise<MatcherResult> => {
  try {
    const actual = await workspace.tree();
    
    const expectedKeys = new Set(Object.keys(expected));
    const actualKeys = new Set(Object.keys(actual));
    
    // Find differences
    const missing = [...expectedKeys].filter(k => !actualKeys.has(k));
    const extra = [...actualKeys].filter(k => !expectedKeys.has(k));
    const different: string[] = [];
    
    for (const key of expectedKeys) {
      if (actualKeys.has(key) && expected[key] !== actual[key]) {
        different.push(key);
      }
    }
    
    const hasErrors = missing.length > 0 || extra.length > 0 || different.length > 0;
    
    if (!hasErrors) {
      return {
        pass: true,
        message: () => "Directory structures match exactly"
      };
    }
    
    // Build detailed error message
    const errors: string[] = [];
    
    if (missing.length > 0) {
      errors.push(`Missing files: ${missing.join(', ')}`);
    }
    
    if (extra.length > 0) {
      errors.push(`Unexpected files: ${extra.join(', ')}`);
    }
    
    if (different.length > 0) {
      errors.push(`Content differs: ${different.join(', ')}`);
      different.forEach(file => {
        const expectedLines = expected[file].split('\\n');
        const actualLines = actual[file].split('\\n');
        const diff = createUnifiedDiff(expectedLines, actualLines, file);
        errors.push(`\\n${diff}`);
      });
    }
    
    return {
      pass: false,
      message: () => `Directory structure mismatch:\\n${errors.join('\\n')}`
    };
    
  } catch (error) {
    return {
      pass: false,
      message: () => `Failed to compare directories: ${(error as Error).message}`
    };
  }
};

/**
 * Chronicle event matcher - checks if event array contains matching event
 */
export const toContainEvent: ChronicleEventMatcher = (
  events: any[],
  pattern: EventPattern
): MatcherResult => {
  const matchingEvent = events.find(event => {
    return Object.entries(pattern).every(([key, value]) => {
      if (key === 'actor' && typeof value === 'object' && value !== null) {
        // Special handling for actor object
        return Object.entries(value).every(([actorKey, actorValue]) => 
          event.actor?.[actorKey] === actorValue
        );
      }
      return event[key] === value;
    });
  });
  
  if (matchingEvent) {
    return {
      pass: true,
      message: () => `Found matching event: ${JSON.stringify(matchingEvent, null, 2)}`
    };
  }
  
  return {
    pass: false,
    message: () => {
      const patternStr = JSON.stringify(pattern, null, 2);
      const eventsStr = events.map(e => ({ type: e.type, eventId: e.eventId?.substring(0, 8) }));
      return `Expected to find event matching:\\n${patternStr}\\nIn events:\\n${JSON.stringify(eventsStr, null, 2)}`;
    }
  };
};

/**
 * Graph commit addressability matcher - validates MVCC fields
 */
export const toBeCommitAddressable: GraphNodeMatcher = (
  received: GraphNode | GraphNode[]
): MatcherResult => {
  const nodes = Array.isArray(received) ? received : [received];
  const issues: string[] = [];
  
  for (const node of nodes) {
    // Check required fields
    if (!node.id) {
      issues.push(`Node missing required 'id' field: ${JSON.stringify(node)}`);
    }
    
    if (!node.first_seen) {
      issues.push(`Node ${node.id} missing 'first_seen' commit field`);
    }
    
    // Validate commit format (simple validation)
    if (node.first_seen && !/^[a-f0-9]+$/i.test(node.first_seen)) {
      issues.push(`Node ${node.id} has invalid 'first_seen' format: ${node.first_seen}`);
    }
    
    if (node.last_seen && !/^[a-f0-9]+$/i.test(node.last_seen)) {
      issues.push(`Node ${node.id} has invalid 'last_seen' format: ${node.last_seen}`);
    }
    
    // Check commit ordering if both present
    if (node.first_seen && node.last_seen && node.first_seen >= node.last_seen) {
      issues.push(`Node ${node.id} has invalid commit ordering: first_seen (${node.first_seen}) >= last_seen (${node.last_seen})`);
    }
    
    // Check for required properties based on labels
    if (node.labels.includes('File') && !node.properties.path) {
      issues.push(`File node ${node.id} missing 'path' property`);
    }
    
    if (node.labels.includes('Function') && !node.properties.name) {
      issues.push(`Function node ${node.id} missing 'name' property`);
    }
  }
  
  if (issues.length === 0) {
    return {
      pass: true,
      message: () => `All ${nodes.length} node(s) are properly commit-addressable`
    };
  }
  
  return {
    pass: false,
    message: () => `Commit addressability issues found:\\n${issues.join('\\n')}`
  };
};

/**
 * Transaction boundary matcher - validates staging/commit behavior
 */
export const toRespectTransactionBoundary: TransactionMatcher = (
  state: TransactionState
): MatcherResult => {
  const issues: string[] = [];
  
  // Group operations by type
  const readOps = state.operations.filter(op => op.type === 'read');
  const writeOps = state.operations.filter(op => op.type === 'write' || op.type === 'edit');
  const deleteOps = state.operations.filter(op => op.type === 'delete');
  
  // Check that writes only happened in staging
  const productionWrites = writeOps.filter(op => 
    op.path.startsWith(state.productionDir) && !op.path.startsWith(state.stagingDir)
  );
  
  if (productionWrites.length > 0) {
    issues.push(`Found ${productionWrites.length} write operations outside staging area:`);
    productionWrites.forEach(op => {
      issues.push(`  - ${op.type} to ${op.path} at ${op.timestamp}`);
    });
  }
  
  // Check operation ordering (writes should come after reads)
  const sortedOps = [...state.operations].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  let hasWriteStarted = false;
  for (const op of sortedOps) {
    if (op.type === 'write' || op.type === 'edit' || op.type === 'delete') {
      hasWriteStarted = true;
    } else if (op.type === 'read' && hasWriteStarted) {
      // Read after write might violate transaction isolation
      issues.push(`Read operation after write detected: ${op.type} ${op.path} at ${op.timestamp}`);
    }
  }
  
  // Check for proper cleanup (no temp files left behind)
  const tempFiles = state.operations
    .filter(op => op.path.includes('.tmp') || op.path.includes('.staging'))
    .filter(op => op.type !== 'delete'); // Still exist
    
  if (tempFiles.length > 0) {
    issues.push(`Temporary files not cleaned up: ${tempFiles.map(op => op.path).join(', ')}`);
  }
  
  if (issues.length === 0) {
    return {
      pass: true,
      message: () => `Transaction boundary properly respected (${state.operations.length} operations)`
    };
  }
  
  return {
    pass: false,
    message: () => `Transaction boundary violations:\\n${issues.join('\\n')}`
  };
};

// Helper function to create unified diff
function createUnifiedDiff(expectedLines: string[], actualLines: string[], filename: string): string {
  const diff: string[] = [];
  diff.push(`--- expected/${filename}`);
  diff.push(`+++ actual/${filename}`);
  
  const maxLines = Math.max(expectedLines.length, actualLines.length);
  let contextStart = 0;
  let inDiff = false;
  
  for (let i = 0; i < maxLines; i++) {
    const expectedLine = expectedLines[i] || '';
    const actualLine = actualLines[i] || '';
    
    if (expectedLine !== actualLine) {
      if (!inDiff) {
        // Start new diff section
        diff.push(`@@ -${i + 1},${maxLines - i} +${i + 1},${maxLines - i} @@`);
        inDiff = true;
      }
      
      if (expectedLine) {
        diff.push(`-${expectedLine}`);
      }
      if (actualLine) {
        diff.push(`+${actualLine}`);
      }
    } else if (inDiff) {
      // Context line in diff section
      diff.push(` ${expectedLine}`);
      inDiff = false;
    }
  }
  
  return diff.join('\\n');
}

// Additional protocol-specific matchers

/**
 * Bullet Wound Invariant matcher - checks for halt condition
 */
export function toHaltOnContradiction(
  events: any[]
): MatcherResult {
  const haltEvent = events.find(e => e.type === 'HALT_AND_REPORT');
  
  if (haltEvent) {
    return {
      pass: true,
      message: () => `System properly halted on contradiction: ${haltEvent.invariant}`
    };
  }
  
  return {
    pass: false,
    message: () => `Expected HALT_AND_REPORT event but none found in ${events.length} events`
  };
}

/**
 * Unsafe Protocol matcher - checks for safety stamping
 */
export function toStampUnsafe(
  events: any[],
  expectedPlanId?: string
): MatcherResult {
  const unsafeEvents = events.filter(e => e.type === 'PLAN_UNSAFE');
  
  if (expectedPlanId) {
    const planUnsafeEvent = unsafeEvents.find(e => e.planId === expectedPlanId);
    if (planUnsafeEvent) {
      return {
        pass: true,
        message: () => `Plan ${expectedPlanId} properly stamped as unsafe`
      };
    }
    
    return {
      pass: false,
      message: () => `Plan ${expectedPlanId} not stamped as unsafe (found ${unsafeEvents.length} other unsafe events)`
    };
  }
  
  if (unsafeEvents.length > 0) {
    return {
      pass: true,
      message: () => `Found ${unsafeEvents.length} unsafe plan stamp(s)`
    };
  }
  
  return {
    pass: false,
    message: () => `No PLAN_UNSAFE events found in ${events.length} events`
  };
}

/**
 * Reconciliation matcher - checks for proper reconciliation flow
 */
export function toReconcileChanges(
  events: any[],
  expectedFilePath?: string
): MatcherResult {
  const rogueEditEvents = events.filter(e => e.type === 'ROGUE_EDIT_DETECTED');
  const reconciliationEvents = events.filter(e => e.type === 'RECONCILIATION');
  
  if (expectedFilePath) {
    const fileRogueEvent = rogueEditEvents.find(e => e.filePath === expectedFilePath);
    const fileReconEvent = reconciliationEvents.find(e => e.filePath === expectedFilePath);
    
    if (fileRogueEvent && fileReconEvent) {
      // Check ordering
      const rogueIndex = events.indexOf(fileRogueEvent);
      const reconIndex = events.indexOf(fileReconEvent);
      
      if (reconIndex > rogueIndex) {
        return {
          pass: true,
          message: () => `File ${expectedFilePath} properly reconciled after rogue edit detection`
        };
      }
      
      return {
        pass: false,
        message: () => `Reconciliation event occurred before rogue edit detection for ${expectedFilePath}`
      };
    }
    
    return {
      pass: false,
      message: () => `Missing reconciliation flow for ${expectedFilePath} (rogue: ${!!fileRogueEvent}, recon: ${!!fileReconEvent})`
    };
  }
  
  if (reconciliationEvents.length > 0) {
    return {
      pass: true,
      message: () => `Found ${reconciliationEvents.length} reconciliation event(s)`
    };
  }
  
  return {
    pass: false,
    message: () => `No reconciliation events found`
  };
}

/**
 * Causal chain matcher - validates chronicle event ordering
 */
export function toMaintainCausalChain(
  events: any[]
): MatcherResult {
  const issues: string[] = [];
  
  // Check that events have proper timestamp ordering
  for (let i = 1; i < events.length; i++) {
    const prevEvent = events[i - 1];
    const currentEvent = events[i];
    
    if (prevEvent.timestamp && currentEvent.timestamp) {
      const prevTime = new Date(prevEvent.timestamp).getTime();
      const currentTime = new Date(currentEvent.timestamp).getTime();
      
      if (currentTime < prevTime) {
        issues.push(`Event ${i} has timestamp earlier than previous event (${currentEvent.timestamp} < ${prevEvent.timestamp})`);
      }
    }
    
    // Check for prevEventId references if implemented
    if (currentEvent.prevEventId && currentEvent.prevEventId !== prevEvent.eventId) {
      issues.push(`Event ${i} has incorrect prevEventId reference (${currentEvent.prevEventId} != ${prevEvent.eventId})`);
    }
  }
  
  // Check for proper eventId uniqueness
  const eventIds = events.map(e => e.eventId).filter(Boolean);
  const uniqueIds = new Set(eventIds);
  
  if (eventIds.length !== uniqueIds.size) {
    issues.push(`Found duplicate eventIds: ${eventIds.length} total, ${uniqueIds.size} unique`);
  }
  
  if (issues.length === 0) {
    return {
      pass: true,
      message: () => `Causal chain properly maintained across ${events.length} events`
    };
  }
  
  return {
    pass: false,
    message: () => `Causal chain violations:\\n${issues.join('\\n')}`
  };
}