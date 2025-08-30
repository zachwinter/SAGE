export interface GitCommitResult {
    success: boolean;
    commitHash?: string;
    error?: Error;
}
export interface GitCheckoutResult {
    success: boolean;
    databasePath?: string;
    error?: Error;
}
/**
 * Git integration for database versioning.
 * Handles committing database snapshots and checking out historical states.
 */
export declare class GitDatabaseManager {
    private readonly projectRoot;
    private readonly debug;
    constructor(projectRoot: string, debug?: boolean);
    /**
     * Commit database file to git after successful ingestion.
     */
    commitDatabase(databasePath: string, commitHash: string, message?: string): Promise<GitCommitResult>;
    /**
     * Checkout database file from a specific commit for querying.
     * Returns path to temporary database file.
     */
    checkoutDatabaseAtCommit(databasePath: string, commitHash: string): Promise<GitCheckoutResult>;
    /**
     * Clean up temporary database files created during historical queries.
     */
    cleanupTempDatabases(databasePath: string): Promise<void>;
    /**
     * Check if current directory is in a git repository.
     */
    isGitRepository(): Promise<boolean>;
    /**
     * Get current git commit hash.
     */
    getCurrentCommitHash(): Promise<string | null>;
    /**
     * Check if there are uncommitted changes that might affect database state.
     */
    hasUncommittedChanges(): Promise<boolean>;
    /**
     * Check if a specific commit has already been ingested.
     */
    isCommitIngested(commitHash: string): Promise<boolean>;
    private runGitCommand;
}
/**
 * Simplified git utilities for basic operations.
 */
export declare const gitUtils: {
    /**
     * Get current commit hash in a project directory.
     */
    getCurrentCommit(projectPath: string): Promise<string | null>;
    /**
     * Check if project has uncommitted changes.
     */
    hasChanges(projectPath: string): Promise<boolean>;
};
//# sourceMappingURL=git-hooks.d.ts.map