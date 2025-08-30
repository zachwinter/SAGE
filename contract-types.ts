/**
 * SAGE Contract Types - Extracted for TypeDoc Generation
 *
 * This file extracts all TypeScript type definitions from CONTRACT.md
 * to generate a hyperlinked type reference using TypeDoc.
 *
 * @packageDocumentation
 */

// @sage/utils
export namespace SageUtils {
  /**
   * ISO8601 timestamp string.
   * @example "2024-01-01T12:00:00.000Z"
   */
  export type ISO8601 = string;

  export interface Clock {
    /**
     * Returns current time as ISO8601 string.
     * @returns ISO8601 timestamp
     */
    now(): ISO8601;
  }

  export interface Random {
    /** Returns a random integer */
    int(): number;
    /** Returns a random float between 0 and 1 */
    float(): number;
  }

  export interface TypedError extends Error {
    /** Error classification code (EVALIDATION, EIO, etc.) */
    code: string;
    /** Optional underlying cause of the error */
    cause?: unknown;
    /** Additional error-specific properties */
    [key: string]: any;
  }

  /**
   * Create a typed error with standard structure.
   * @param code Error classification (EVALIDATION, EIO, etc.)
   * @param message Human-readable error message
   * @param cause Optional underlying cause
   */
  export function err(code: string, message: string, cause?: unknown): TypedError;

  /**
   * Convert object to canonical JSON string with stable key ordering.
   * Keys are sorted alphabetically at all nesting levels.
   * @example canonicalJSONStringify({c:3,a:1,b:[{y:2,x:1}]}) === '{"a":1,"b":[{"x":1,"y":2}],"c":3}'
   */
  export function canonicalJSONStringify(o: unknown): string;

  /**
   * Compute SHA-256 hash as lowercase hex string.
   * @param text Input string or bytes to hash
   * @returns Hex-encoded hash string
   * @example await sha256("hello") === "2cf24dba4f21d4288094c57d4a8bb4a4d8a1c5c70e8b8c6a93c1c5c3e36da4a2"
   */
  export function sha256(text: string | Uint8Array): Promise<string>;
}

// @sage/chronicle
export namespace SageChronicle {
  /**
   * A POSIX-style path relative to the workspace root, ending in `.sage`.
   * @example "src/Foo.ts.sage"
   * @example ".sage/warden.dev.sage"
   */
  export type ChroniclePath = string;

  export interface Actor {
    /** Agent archetype name (sage, guardian, warden, etc.) */
    agent: string;
    /** Unique identifier for this agent instance */
    id: string;
  }

  export interface ChronicleEventBase {
    /** Event type identifier (FUNCTION_ADDED, ROGUE_EDIT_DETECTED, etc.) */
    type: string;
    /**
     * SHA-256 hash of the canonical JSON representation of the event.
     * Computed by the library if not provided.
     * @example "f25f2b4c8a7d3e9f..."
     */
    eventId?: string;
    /**
     * Event timestamp in ISO8601 format.
     * @example "2024-01-01T12:00:00.000Z"
     */
    timestamp: string;
    /** The agent that created this event */
    actor: Actor;
    /**
     * Hash of the plan that triggered this event.
     * @example "abc123def456"
     */
    planHash?: string;
    /**
     * Commit hash in the graph database when this event occurred.
     * @example "commit-789"
     */
    graphCommit?: string;
    /**
     * Hash of the previous event for chain integrity.
     * @example "e3b0c44298fc1c14..."
     */
    prevEventId?: string;
    /**
     * Categorization tags for filtering and analysis.
     * @example ["refactor", "typescript"]
     */
    tags?: string[];
  }

  export type ChronicleEvent = ChronicleEventBase & Record<string, unknown>;

  export interface AppendOptions {
    /** Whether to compute eventId automatically (default: true) */
    computeId?: boolean;
    /** Lock timeout in milliseconds (default: 2000) */
    lockTimeoutMs?: number;
  }
}

// @sage/graph
export namespace SageGraph {
  export interface IngestOptions {
    /** Path to the project being ingested */
    projectPath: string;
    /** Git commit hash for this ingestion */
    commitHash: string;
  }

  export interface QueryOptions {
    /** Cypher query string */
    query: string;
    /** Query parameters */
    params?: Record<string, any>;
    /** Optional commit hash to query at */
    commit?: string;
  }

  export interface QueryResult<T = any> {
    /** Query results array */
    results: T[];
    /** Error if query failed */
    error?: Error;
  }
}

// Error Taxonomy
export namespace SageErrors {
  /** Base error interface */
  export interface TypedError extends Error {
    code: string;
    cause?: unknown;
    [key: string]: any;
  }

  /** EVALIDATION error details */
  export interface ValidationErrorDetails {
    details: Array<{
      field: string;
      reason: string;
      received?: any;
      expected?: any;
    }>;
  }

  /** EPERMISSION error details */
  export interface PermissionErrorDetails {
    resource: string;
    operation: string;
    policy?: string;
  }

  /** ETIMEOUT error details */
  export interface TimeoutErrorDetails {
    timeoutMs: number;
    elapsedMs: number;
    operation: string;
  }

  /** EIO error details */
  export interface IOErrorDetails {
    path?: string;
    operation: string;
    code?: string;
  }

  /** ELOCK_TIMEOUT error details */
  export interface LockTimeoutErrorDetails {
    path: string;
    timeoutMs: number;
    holder?: string;
  }

  /** EHALT error details */
  export interface HaltErrorDetails {
    invariant: string;
    expected: any;
    actual: any;
    context?: {
      graphCommit?: string;
      chroniclePath?: string;
      [key: string]: any;
    };
  }
}
