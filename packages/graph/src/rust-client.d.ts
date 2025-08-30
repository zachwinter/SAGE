import type { QueryResult, DatabaseConfig } from './types.js';
/**
 * Low-level client for kuzu-rust binary operations.
 * Handles direct communication with the Rust binary for queries and database operations.
 */
export declare class RustKuzuClient {
    private readonly binaryPath;
    private readonly timeoutMs;
    private readonly debug;
    constructor(config?: DatabaseConfig);
    /**
     * Execute a Cypher query against a database file.
     */
    query<T = any>(databasePath: string, cypher: string, params?: Record<string, any>): Promise<QueryResult<T>>;
    /**
     * Check if the Rust binary is accessible and responsive.
     */
    healthCheck(): Promise<boolean>;
    /**
     * Ensure a directory exists for database files.
     */
    ensureDbDirectory(databasePath: string): Promise<void>;
    /**
     * Check if a database file exists.
     */
    databaseExists(databasePath: string): Promise<boolean>;
    /**
     * Delete a database file and its associated files.
     */
    deleteDatabase(databasePath: string): Promise<void>;
    private runRustCommand;
    private substituteParameters;
    private escapeQueryValue;
    private parseQueryOutput;
    private parseValue;
    private mapError;
}
//# sourceMappingURL=rust-client.d.ts.map