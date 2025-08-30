import { spawn } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { dirname } from "path";
import { exportGraphToJson } from "./export/json-exporter.js";
const RUST_BINARY_PATH = process.env.KUZU_RUST_PATH || "/Users/zach/dev/kuzu-rust/target/release/kuzu-rust";
export class RustKuzuIngestor {
    dbPath;
    serverProcess = null;
    serverReady = false;
    constructor(dbPath) {
        this.dbPath = dbPath;
        const dbDir = dirname(dbPath);
        mkdirSync(dbDir, { recursive: true });
    }
    async initialize() {
        await this.performHandshake();
    }
    /**
     * Start the Kùzu ingestion server process for improved performance
     */
    async startServer() {
        return new Promise((resolve, reject) => {
            // Start the server process
            this.serverProcess = spawn(RUST_BINARY_PATH, ["server", this.dbPath], {
                stdio: ["pipe", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            this.serverProcess?.stdout?.on("data", data => {
                stdout += data.toString();
                // Check if the server is ready
                if (stdout.includes("ready to receive data")) {
                    this.serverReady = true;
                    resolve();
                }
            });
            this.serverProcess?.stderr?.on("data", data => {
                stderr += data.toString();
                // Log any stderr output
                console.error("Rust server stderr:", data.toString().trim());
            });
            this.serverProcess?.on("close", code => {
                if (code !== 0) {
                    reject(new Error(`Rust server failed with code ${code}: ${stderr}`));
                }
            });
            this.serverProcess?.on("error", error => {
                reject(new Error(`Failed to spawn Rust server process: ${error.message}`));
            });
        });
    }
    /**
     * Stop the Kùzu ingestion server process
     */
    async stopServer() {
        if (this.serverProcess) {
            // If stdin is still open, send quit command
            if (this.serverProcess.stdin &&
                !this.serverProcess.stdin.destroyed &&
                !this.serverProcess.stdin.writableEnded) {
                this.serverProcess.stdin.write("quit\n");
                this.serverProcess.stdin.end();
            }
            // Wait for the process to exit
            return new Promise(resolve => {
                const cleanup = () => {
                    this.serverProcess = null;
                    this.serverReady = false;
                    resolve();
                };
                if (this.serverProcess) {
                    this.serverProcess.on("close", cleanup);
                    // Force kill if it doesn't exit gracefully within 5 seconds
                    setTimeout(() => {
                        if (this.serverProcess && !this.serverProcess.killed) {
                            this.serverProcess.kill();
                        }
                        cleanup();
                    }, 5000);
                }
                else {
                    resolve();
                }
            });
        }
    }
    /**
     * Send data to the server for immediate ingestion
     */
    async ingestToServer(analysisData, batchSize = 1000) {
        if (!this.serverProcess || !this.serverProcess.stdin || !this.serverReady) {
            throw new Error("Server is not running or not ready");
        }
        const startTime = Date.now();
        let totalEntities = 0;
        let totalRelationships = 0;
        let stdoutBuffer = "";
        let resolvedOrRejected = false;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true;
                    reject(new Error("Ingestion timeout - server did not respond in time"));
                }
            }, 300000); // 5 minute timeout
            // Handle server output
            const handleServerOutput = (data) => {
                // Add new data to buffer and split by lines
                stdoutBuffer += data.toString();
                const lines = stdoutBuffer.split("\n");
                // Keep the last partial line in the buffer
                stdoutBuffer = lines.pop() || "";
                // Process complete lines
                for (const line of lines) {
                    const output = line.trim();
                    if (output.includes("Ingested") ||
                        output.includes("Transaction committed")) {
                        console.log(output);
                    }
                    else if (output.includes("Shutting down ingestion server")) {
                        // Server is shutting down
                        console.log("Server shutdown detected");
                    }
                    else if (output.startsWith('{"type":"result"')) {
                        // Parse the result message from the server
                        try {
                            const resultMessage = JSON.parse(output);
                            if (resultMessage.type === "result" && resultMessage.success) {
                                if (!resolvedOrRejected) {
                                    resolvedOrRejected = true;
                                    const duration = Date.now() - startTime;
                                    clearTimeout(timeout);
                                    resolve({
                                        entities: resultMessage.stats.entities,
                                        relationships: resultMessage.stats.relationships,
                                        duration
                                    });
                                }
                                return; // Exit early after resolving
                            }
                            else {
                                if (!resolvedOrRejected) {
                                    resolvedOrRejected = true;
                                    clearTimeout(timeout);
                                    reject(new Error(`Ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`));
                                }
                                return; // Exit early after rejecting
                            }
                        }
                        catch (parseError) {
                            console.error("Failed to parse server response:", output);
                            // Continue processing other lines
                        }
                    }
                }
            };
            // Handle server close event
            const handleServerClose = (code) => {
                if (code !== null && code !== 0) {
                    if (!resolvedOrRejected) {
                        resolvedOrRejected = true;
                        clearTimeout(timeout);
                        reject(new Error(`Rust server process exited with code ${code}`));
                    }
                }
                else if (code === 0) {
                    // Server exited successfully
                    if (!resolvedOrRejected) {
                        // If not already resolved/rejected by handleServerOutput
                        // Attempt to process any remaining stdoutBuffer for a result message
                        const lines = stdoutBuffer.split("\n");
                        for (const line of lines) {
                            const output = line.trim();
                            if (output.startsWith('{"type":"result"')) {
                                try {
                                    const resultMessage = JSON.parse(output);
                                    if (resultMessage.type === "result" && resultMessage.success) {
                                        resolvedOrRejected = true;
                                        const duration = Date.now() - startTime;
                                        clearTimeout(timeout);
                                        resolve({
                                            entities: resultMessage.stats.entities,
                                            relationships: resultMessage.stats.relationships,
                                            duration
                                        });
                                        return;
                                    }
                                    else {
                                        resolvedOrRejected = true;
                                        clearTimeout(timeout);
                                        reject(new Error(`Ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`));
                                        return;
                                    }
                                }
                                catch (parseError) {
                                    console.error("Failed to parse server response in handleServerClose:", output);
                                }
                            }
                        }
                        // If we reached here, server closed successfully but no result message was found
                        // This is an unexpected scenario, so reject.
                        resolvedOrRejected = true;
                        clearTimeout(timeout);
                        reject(new Error("Rust server exited successfully but no result message was received."));
                    }
                }
            };
            // Handle server error event
            const handleServerError = (error) => {
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true;
                    clearTimeout(timeout);
                    reject(new Error(`Rust server error: ${error.message}`));
                }
            };
            if (this.serverProcess && this.serverProcess.stdout) {
                this.serverProcess.stdout.on("data", handleServerOutput);
            }
            if (this.serverProcess) {
                this.serverProcess.on("close", handleServerClose);
                this.serverProcess.on("error", handleServerError);
            }
            try {
                // Send entities in batches
                for (let i = 0; i < analysisData.entities.length; i += batchSize) {
                    const batch = analysisData.entities.slice(i, i + batchSize);
                    const message = {
                        type: "entities",
                        data: batch
                    };
                    if (!this.serverProcess?.stdin?.write(JSON.stringify(message) + "\n")) {
                        // Handle backpressure
                        this.serverProcess?.stdin?.once("drain", () => { });
                    }
                    totalEntities += batch.length;
                }
                // Group relationships by type and send in batches
                const relationshipsByType = new Map();
                for (const rel of analysisData.relationships) {
                    if (!relationshipsByType.has(rel.type)) {
                        relationshipsByType.set(rel.type, []);
                    }
                    relationshipsByType.get(rel.type).push(rel);
                }
                for (const [relType, rels] of Array.from(relationshipsByType.entries())) {
                    for (let i = 0; i < rels.length; i += batchSize) {
                        const batch = rels.slice(i, i + batchSize);
                        const message = {
                            type: "relationships",
                            relationshipType: relType,
                            data: batch
                        };
                        if (!this.serverProcess?.stdin?.write(JSON.stringify(message) + "\n")) {
                            // Handle backpressure
                            this.serverProcess?.stdin?.once("drain", () => { });
                        }
                        totalRelationships += batch.length;
                    }
                }
                // Send complete message
                const completeMessage = {
                    type: "complete"
                };
                if (!this.serverProcess?.stdin?.write(JSON.stringify(completeMessage) + "\n")) {
                    // Handle backpressure for complete message
                    this.serverProcess?.stdin?.once("drain", () => { });
                }
                // Close stdin to signal we're done sending data
                this.serverProcess?.stdin?.end();
            }
            catch (error) {
                if (!resolvedOrRejected) {
                    resolvedOrRejected = true;
                    clearTimeout(timeout);
                    reject(error);
                }
            }
        });
    }
    async performHandshake() {
        const result = await this.runRustCommand("handshake", []);
        try {
            const ackMessage = JSON.parse(result);
            if (ackMessage.type !== "ack" || !ackMessage.ready) {
                throw new Error("Rust tool not ready or invalid handshake response");
            }
            return ackMessage;
        }
        catch (error) {
            throw new Error(`Handshake failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ingest(analysisData) {
        const jsonPath = exportGraphToJson(analysisData);
        try {
            const result = await this.runRustCommand("ingest", [jsonPath, this.dbPath]);
            const resultMessage = this.parseStructuredResult(result);
            if (!resultMessage.success) {
                throw new Error(`Ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`);
            }
            return resultMessage.stats;
        }
        finally {
            try {
                rmSync(jsonPath, { force: true });
            }
            catch {
                // Ignore cleanup errors
            }
        }
    }
    async ingestStream(analysisData, batchSize = 10000, progressCallback) {
        return new Promise((resolve, reject) => {
            const process = spawn(RUST_BINARY_PATH, ["ingest-stream", this.dbPath], {
                stdio: ["pipe", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            process.stdout.on("data", data => {
                stdout += data.toString();
                const lines = data.toString().split("\n");
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('{"type":')) {
                        if (progressCallback) {
                            progressCallback(trimmed);
                        }
                        else {
                            console.log(trimmed);
                        }
                    }
                }
            });
            process.stderr.on("data", data => {
                stderr += data.toString();
                // Only log stderr if it contains actual error messages, not just progress info
                const stderrStr = data.toString().trim();
                if (stderrStr &&
                    !stderrStr.includes("total time:") &&
                    !stderrStr.includes("entities:") &&
                    !stderrStr.includes("relationships:")) {
                    console.error("Rust stderr:", stderrStr);
                }
            });
            process.on("close", code => {
                if (code === 0) {
                    try {
                        const resultMessage = this.parseStructuredResult(stdout);
                        if (!resultMessage.success) {
                            reject(new Error(`Streaming ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`));
                            return;
                        }
                        resolve(resultMessage.stats);
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse streaming result: ${error instanceof Error ? error.message : String(error)}`));
                    }
                }
                else {
                    // Filter out progress info from stderr when logging the error
                    const filteredStderr = stderr
                        .split("\n")
                        .filter(line => line.trim() &&
                        !line.includes("total time:") &&
                        !line.includes("entities:") &&
                        !line.includes("relationships:"))
                        .join("\n");
                    reject(new Error(`Rust streaming ingestion failed with code ${code}: ${filteredStderr || "No error details"}`));
                }
            });
            process.on("error", error => {
                reject(new Error(`Failed to spawn Rust streaming process: ${error.message}`));
            });
            this.streamDataToProcess(process, analysisData, batchSize).catch(reject);
        });
    }
    async ingestBulk(analysisData) {
        return new Promise((resolve, reject) => {
            const process = spawn(RUST_BINARY_PATH, ["ingest-bulk", this.dbPath], {
                stdio: ["pipe", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            process.stdout.on("data", data => {
                stdout += data.toString();
                // console.log("Bulk progress:", data.toString().trim());
            });
            process.stderr.on("data", data => {
                stderr += data.toString();
                // Only log stderr if it contains actual error messages, not just progress info
                const stderrStr = data.toString().trim();
                if (stderrStr &&
                    !stderrStr.includes("total time:") &&
                    !stderrStr.includes("entities:") &&
                    !stderrStr.includes("relationships:")) {
                    console.error("Rust stderr:", stderrStr);
                }
            });
            process.on("close", code => {
                if (code === 0) {
                    try {
                        const resultMessage = this.parseStructuredResult(stdout);
                        if (!resultMessage.success) {
                            reject(new Error(`Bulk ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`));
                            return;
                        }
                        resolve(resultMessage.stats);
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse bulk result: ${error instanceof Error ? error.message : String(error)}`));
                    }
                }
                else {
                    reject(new Error(`Rust bulk ingestion failed with code ${code}: ${stderr}`));
                }
            });
            process.on("error", error => {
                reject(new Error(`Failed to spawn Rust bulk process: ${error.message}`));
            });
            // Stream CSV data to stdin
            this.streamCSVToProcess(process, analysisData).catch(reject);
        });
    }
    async query(cypher) {
        const result = await this.runRustCommand("query", [cypher, this.dbPath]);
        return this.parseQueryOutput(result);
    }
    async close() {
        // Nothing to do - Rust binary handles cleanup
    }
    async runRustCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(RUST_BINARY_PATH, [command, ...args], {
                stdio: ["pipe", "pipe", "pipe"]
            });
            let stdout = "";
            let stderr = "";
            process.stdout.on("data", data => {
                stdout += data.toString();
            });
            process.stderr.on("data", data => {
                stderr += data.toString();
            });
            process.on("close", code => {
                if (stderr)
                    console.log(`Stderr:`, stderr);
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Rust command failed with code ${code}: ${stderr}`));
                }
            });
            process.on("error", error => {
                reject(new Error(`Failed to spawn Rust process: ${error.message}`));
            });
        });
    }
    parseStructuredResult(output) {
        try {
            const lines = output.trim().split("\n");
            const jsonLine = lines.find(line => {
                const trimmed = line.trim();
                return trimmed.startsWith("{") && trimmed.includes('"type"');
            });
            if (!jsonLine) {
                throw new Error("No structured result found in output");
            }
            const result = JSON.parse(jsonLine);
            if (result.type !== "result") {
                throw new Error("Invalid result message type");
            }
            return result;
        }
        catch (error) {
            throw new Error(`Failed to parse structured result: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    parseQueryOutput(output) {
        const lines = output.trim().split("\n");
        if (lines.length < 2) {
            return [];
        }
        const headers = lines[0].split("|").map(h => h.trim());
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split("|").map(v => v.trim());
            if (values.length === headers.length) {
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                    // Try to parse numbers
                    const value = values[j];
                    if (/^\d+$/.test(value)) {
                        row[headers[j]] = parseInt(value, 10);
                    }
                    else if (/^\d+\.\d+$/.test(value)) {
                        row[headers[j]] = parseFloat(value);
                    }
                    else {
                        row[headers[j]] = value;
                    }
                }
                results.push(row);
            }
        }
        return results;
    }
    async streamDataToProcess(process, analysisData, batchSize) {
        const stdin = process.stdin;
        try {
            for (let i = 0; i < analysisData.entities.length; i += batchSize) {
                const batch = analysisData.entities.slice(i, i + batchSize);
                // Log first few entities in the batch for debugging (disabled in production)
                // if (batch.length > 0) {
                //   console.log(batch);
                // }
                const ndjsonLine = JSON.stringify({
                    type: "entities",
                    data: batch
                }) + "\n";
                if (!stdin.write(ndjsonLine)) {
                    await new Promise(resolve => stdin.once("drain", resolve));
                }
            }
            const relationshipsByType = new Map();
            for (const rel of analysisData.relationships) {
                if (!relationshipsByType.has(rel.type)) {
                    relationshipsByType.set(rel.type, []);
                }
                relationshipsByType.get(rel.type).push(rel);
            }
            for (const [relType, rels] of relationshipsByType) {
                for (let i = 0; i < rels.length; i += batchSize) {
                    const batch = rels.slice(i, i + batchSize);
                    const ndjsonLine = JSON.stringify({
                        type: "relationships",
                        relationshipType: relType,
                        data: batch
                    }) + "\n";
                    if (!stdin.write(ndjsonLine)) {
                        await new Promise(resolve => stdin.once("drain", resolve));
                    }
                }
            }
            const completeMessage = JSON.stringify({ type: "complete" }) + "\n";
            stdin.write(completeMessage);
            await new Promise(resolve => {
                if (stdin.writableEnded || stdin.destroyed) {
                    resolve(void 0);
                }
                else {
                    stdin.end(resolve);
                }
            });
        }
        catch (error) {
            // console.error("DEBUG: Error in streamDataToProcess:", error);
            stdin.destroy();
            throw error;
        }
    }
    /**
     * Stream analysis data as CSV for bulk COPY FROM ingestion
     */
    async streamCSVToProcess(process, analysisData) {
        const stdin = process.stdin;
        try {
            // Stream entities CSV header + data
            stdin.write("ENTITIES_START\n");
            stdin.write("id,kind,name,text,filePath,lineNum,colNum,startPos,endPos,nodeFlags\n");
            for (const entity of analysisData.entities) {
                const csvLine = [
                    this.escapeCsv(entity.id),
                    this.escapeCsv(entity.kind),
                    this.escapeCsv(entity.name),
                    this.escapeCsv(entity.text),
                    this.escapeCsv(entity.filePath),
                    entity.line.toString(),
                    entity.column_num.toString(),
                    entity.pos.toString(),
                    entity.end.toString(),
                    entity.flags.toString()
                ].join(",") + "\n";
                if (!stdin.write(csvLine)) {
                    await new Promise(resolve => stdin.once("drain", resolve));
                }
            }
            // Stream relationships by type
            const relationshipsByType = new Map();
            for (const rel of analysisData.relationships) {
                if (!relationshipsByType.has(rel.type)) {
                    relationshipsByType.set(rel.type, []);
                }
                relationshipsByType.get(rel.type).push(rel);
            }
            for (const [relType, rels] of relationshipsByType) {
                stdin.write(`RELATIONSHIPS_${relType}_START\n`);
                stdin.write("from,to,evidence,confidence,metadata\n");
                for (const rel of rels) {
                    const csvLine = [
                        this.escapeCsv(rel.from),
                        this.escapeCsv(rel.to),
                        this.escapeCsv(rel.evidence),
                        this.escapeCsv(rel.confidence),
                        this.escapeCsv(JSON.stringify(rel.metadata))
                    ].join(",") + "\n";
                    if (!stdin.write(csvLine)) {
                        await new Promise(resolve => stdin.once("drain", resolve));
                    }
                }
            }
            stdin.write("COMPLETE\n");
            stdin.end();
        }
        catch (error) {
            stdin.destroy();
            throw error;
        }
    }
    escapeCsv(value) {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
//# sourceMappingURL=rust-ingestor.js.map