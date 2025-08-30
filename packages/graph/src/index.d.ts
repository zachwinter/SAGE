import { RustKuzuClient } from './rust-client.js';
import { GitDatabaseManager } from './git-hooks.js';
import type { IngestOptions, QueryOptions, QueryResult, DatabaseConfig } from './types.js';
export type { IngestOptions, QueryOptions, QueryResult, DatabaseConfig } from './types.js';
export { createFirstClassEntity, createSourceFileId } from './entity-utils.js';
export { isRelationshipAllowed } from './relationship-validator.js';
export { getCodeFiles } from './utils/file-finder.js';
export { analyzeToGraph } from './engine/graph-analyzer.js';
export { RustKuzuIngestor } from './rust-ingestor.js';
/**
 * Ingests a project into the graph database.
 */
export declare function ingestProject(options: IngestOptions): Promise<void>;
/**
 * Query the graph database with optional commit-specific queries.
 */
export declare function queryGraph<T = any>(options: QueryOptions): Promise<QueryResult<T>>;
/**
 * Get current database status and metadata.
 */
export declare function getDatabaseStatus(projectPath?: string): Promise<{
    exists: boolean;
    path: string;
    currentCommit?: string;
    hasUncommittedChanges?: boolean;
}>;
/**
 * Utility to create a database connection for advanced use cases.
 * This is for consumers who need direct access to the database.
 */
export declare function createDatabaseClient(config?: DatabaseConfig): RustKuzuClient;
/**
 * Utility to create a git manager for advanced git operations.
 */
export declare function createGitManager(projectPath: string, debug?: boolean): GitDatabaseManager;
//# sourceMappingURL=index.d.ts.map