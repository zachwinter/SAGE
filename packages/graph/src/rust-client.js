import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { err } from '@sage/utils';
const RUST_BINARY_PATH = process.env.KUZU_RUST_PATH || '/Users/zach/dev/kuzu-rust/target/release/kuzu-rust';
/**
 * Low-level client for kuzu-rust binary operations.
 * Handles direct communication with the Rust binary for queries and database operations.
 */
export class RustKuzuClient {
    binaryPath;
    timeoutMs;
    debug;
    constructor(config = {}) {
        this.binaryPath = RUST_BINARY_PATH;
        this.timeoutMs = config.timeoutMs ?? 30_000; // 30s default
        this.debug = config.debug ?? false;
    }
    /**
     * Execute a Cypher query against a database file.
     */
    async query(databasePath, cypher, params) {
        const startTime = Date.now();
        try {
            // Substitute parameters in query (simple approach for v1)
            const processedQuery = this.substituteParameters(cypher, params);
            const result = await this.runRustCommand('query', [processedQuery, databasePath]);
            const results = this.parseQueryOutput(result);
            return {
                results,
                meta: {
                    executionTimeMs: Date.now() - startTime,
                    rowCount: results.length,
                },
            };
        }
        catch (error) {
            return {
                results: [],
                error: this.mapError(error),
                meta: {
                    executionTimeMs: Date.now() - startTime,
                    rowCount: 0,
                },
            };
        }
    }
    /**
     * Check if the Rust binary is accessible and responsive.
     */
    async healthCheck() {
        try {
            const result = await this.runRustCommand('handshake', []);
            const handshakeResponse = JSON.parse(result);
            return handshakeResponse.type === 'ack' && handshakeResponse.ready;
        }
        catch (error) {
            if (this.debug) {
                console.error('Health check failed:', error);
            }
            return false;
        }
    }
    /**
     * Ensure a directory exists for database files.
     */
    async ensureDbDirectory(databasePath) {
        const dir = dirname(databasePath);
        try {
            await fs.mkdir(dir, { recursive: true });
        }
        catch (error) {
            throw err('EIO', `Failed to create database directory: ${dir}`, error);
        }
    }
    /**
     * Check if a database file exists.
     */
    async databaseExists(databasePath) {
        try {
            await fs.access(databasePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Delete a database file and its associated files.
     */
    async deleteDatabase(databasePath) {
        try {
            // Kuzu creates multiple files - remove the main db file
            // The Rust binary should handle cleanup of associated files
            await fs.rm(databasePath, { recursive: true, force: true });
        }
        catch (error) {
            if (this.debug) {
                console.error('Database deletion failed:', error);
            }
            // Non-critical - may not exist
        }
    }
    async runRustCommand(command, args) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                process.kill();
                reject(err('ETIMEOUT', `Rust command timed out after ${this.timeoutMs}ms`));
            }, this.timeoutMs);
            const process = spawn(this.binaryPath, [command, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', (code) => {
                clearTimeout(timeout);
                if (this.debug && stderr) {
                    console.log('Rust stderr:', stderr);
                }
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Rust command failed with code ${code}: ${stderr}`));
                }
            });
            process.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to spawn Rust process: ${error.message}`));
            });
        });
    }
    substituteParameters(query, params) {
        if (!params)
            return query;
        let processedQuery = query;
        // Simple parameter substitution for v1
        // Replace $paramName with actual values
        for (const [key, value] of Object.entries(params)) {
            const placeholder = `$${key}`;
            const escapedValue = this.escapeQueryValue(value);
            processedQuery = processedQuery.replaceAll(placeholder, escapedValue);
        }
        return processedQuery;
    }
    escapeQueryValue(value) {
        if (typeof value === 'string') {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (value === null || value === undefined) {
            return 'null';
        }
        // For objects/arrays, convert to JSON string
        return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
    }
    parseQueryOutput(output) {
        const lines = output.trim().split('\n');
        if (lines.length < 2) {
            return [];
        }
        const headers = lines[0].split('|').map((h) => h.trim());
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('|').map((v) => v.trim());
            if (values.length === headers.length) {
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                    row[headers[j]] = this.parseValue(values[j]);
                }
                results.push(row);
            }
        }
        return results;
    }
    parseValue(value) {
        // Try to parse numbers
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }
        // Try to parse booleans
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        if (value === 'null' || value === 'NULL')
            return null;
        return value;
    }
    mapError(error) {
        if (error instanceof Error && 'code' in error) {
            return error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('timeout') || message.includes('timed out')) {
            return err('ETIMEOUT', 'Query execution timed out');
        }
        if (message.includes('query') || message.includes('syntax')) {
            return err('EVALIDATION', `Invalid query: ${message}`);
        }
        if (message.includes('spawn') || message.includes('binary')) {
            return err('EIO', `Rust binary error: ${message}`);
        }
        return err('EIO', `Database operation failed: ${message}`);
    }
}
//# sourceMappingURL=rust-client.js.map