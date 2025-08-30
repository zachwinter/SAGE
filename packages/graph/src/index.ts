import { join } from 'path';
import { err } from '@sage/utils';
import { RustKuzuClient } from './rust-client.js';
import { GitDatabaseManager } from './git-hooks.js';
import { RustKuzuIngestor } from './rust-ingestor.js';
import type { IngestOptions, QueryOptions, QueryResult, DatabaseConfig } from './types.js';
import { getCodeFiles } from './utils/file-finder.js';
import { analyzeToGraph } from './engine/graph-analyzer.js';

// Re-export types for consumers
export type { IngestOptions, QueryOptions, QueryResult, DatabaseConfig } from './types.js';

// Re-export utility functions
export { createFirstClassEntity, createSourceFileId, getEntityKind } from './entity-utils.js';
export { isRelationshipAllowed } from './relationship-validator.js';
export { getCodeFiles } from './utils/file-finder.js';
export { analyzeToGraph } from './engine/graph-analyzer.js';
export { RustKuzuIngestor } from './rust-ingestor.js';
export { RustKuzuClient } from './rust-client.js';

// Default database path
const DEFAULT_DB_PATH = 'kuzu_db';

/**
 * Ingests a project into the graph database.
 */
export async function ingestProject(options: IngestOptions): Promise<void> {
  const { projectPath, commitHash } = options;

  try {
    // 1. Initialize GitDatabaseManager
    const gitManager = new GitDatabaseManager(projectPath);

    // 2. Ensure the project is a Git repository
    if (!(await gitManager.isGitRepository())) {
      throw err('EVALIDATION', 'Project is not a Git repository.');
    }

    // 3. Get current commit hash if not provided
    const currentCommit = commitHash || (await gitManager.getCurrentCommitHash());
    if (!currentCommit) {
      throw err('EIO', 'Could not determine current commit hash.');
    }

    // 4. Determine database path
    const databasePath = join(projectPath, DEFAULT_DB_PATH);

    // 5. Check if this commit has already been ingested
    if (await gitManager.isCommitIngested(currentCommit)) {
      console.log(`Commit ${currentCommit} already ingested. Skipping.`);
      return;
    }

    // 6. Analyze project using existing analysis pipeline
    const files = getCodeFiles(projectPath);
    const analysisData = analyzeToGraph(files, { includeDeps: true, debug: true });
    
    // 7. Ingest into fresh database using existing RustKuzuIngestor
    const ingestor = new RustKuzuIngestor(databasePath);

    // 8. Commit the database to git
    await gitManager.commitDatabase(databasePath, currentCommit);

  } catch (error) {
    const mappedError = (error instanceof Error && 'code' in error)
      ? error as Error
      : err('EIO', `Ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
    throw mappedError;
  }
}

/**
 * Query the graph database with optional commit-specific queries.
 */
export async function queryGraph<T = any>(options: QueryOptions): Promise<QueryResult<T>> {
  const { query, params, commit } = options;

  try {
    // Determine project root and database path
    // For now, assume we're running from project root
    const projectPath = process.cwd();
    const databasePath = join(projectPath, DEFAULT_DB_PATH);
    
    const client = new RustKuzuClient();
    const gitManager = new GitDatabaseManager(projectPath);

    let actualDbPath = databasePath;
    let shouldCleanup = false;

    // If commit is specified, checkout historical database
    if (commit) {
      const checkoutResult = await gitManager.checkoutDatabaseAtCommit(databasePath, commit);
      
      if (!checkoutResult.success || !checkoutResult.databasePath) {
        return {
          results: [],
          error: checkoutResult.error || err('EIO', `Failed to checkout database at commit ${commit}`),
          meta: {
            commit,
            executionTimeMs: 0,
            rowCount: 0,
          },
        };
      }
      
      actualDbPath = checkoutResult.databasePath;
      shouldCleanup = true;
    }

    try {
      // Execute query
      const result = await client.query<T>(actualDbPath, query, params);
      
      // Add commit info to metadata
      if (result.meta) {
        result.meta.commit = commit;
      }
      
      return result;
      
    } finally {
      // Cleanup temporary database if needed
      if (shouldCleanup) {
        await gitManager.cleanupTempDatabases(databasePath);
      }
    }
    
  } catch (error) {
    const mappedError = (error instanceof Error && 'code' in error)
      ? error as Error
      : err('EIO', `Query execution failed: ${error instanceof Error ? error.message : String(error)}`);

    return {
      results: [],
      error: mappedError,
      meta: {
        commit,
        executionTimeMs: 0,
        rowCount: 0,
      },
    };
  }
}

/**
 * Get current database status and metadata.
 */
export async function getDatabaseStatus(projectPath?: string): Promise<{
  exists: boolean;
  path: string;
  currentCommit?: string;
  hasUncommittedChanges?: boolean;
}> {
  const resolvedPath = projectPath || process.cwd();
  const databasePath = join(resolvedPath, DEFAULT_DB_PATH);
  
  const client = new RustKuzuClient();
  const gitManager = new GitDatabaseManager(resolvedPath);
  
  const exists = await client.databaseExists(databasePath);
  const currentCommit = await gitManager.getCurrentCommitHash();
  const hasUncommittedChanges = await gitManager.hasUncommittedChanges();
  
  return {
    exists,
    path: databasePath,
    currentCommit: currentCommit || undefined,
    hasUncommittedChanges,
  };
}

/**
 * Utility to create a database connection for advanced use cases.
 * This is for consumers who need direct access to the database.
 */
export function createDatabaseClient(config?: DatabaseConfig): RustKuzuClient {
  return new RustKuzuClient(config);
}

/**
 * Utility to create a git manager for advanced git operations.
 */
export function createGitManager(projectPath: string, debug = false): GitDatabaseManager {
  return new GitDatabaseManager(projectPath, debug);
}