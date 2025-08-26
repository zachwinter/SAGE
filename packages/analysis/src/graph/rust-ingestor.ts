import { spawn } from "child_process";
import { rmSync, mkdirSync } from "fs";
import { dirname } from "path";
import { exportGraphToJson } from "../export/json-exporter.js";
import type { AnalysisData } from "../types.js";

/**
 * Path to the Rust kuzu-rust binary
 * This assumes the binary is built and accessible
 */
const RUST_BINARY_PATH =
  process.env.KUZU_RUST_PATH || "/Users/zach/dev/kuzu-rust/target/release/kuzu-rust";

export interface IngestStats {
  entities: number;
  relationships: number;
  duration: number;
}

// Protocol message types for handshake
interface InitMessage {
  type: "init";
  version: string;
  preferredMode: "stream" | "bulk" | "file";
  batchSize?: number;
}

interface AckMessage {
  type: "ack";
  version: string;
  supportedModes: string[];
  ready: boolean;
}

interface ResultMessage {
  type: "result";
  stats: IngestStats;
  success: boolean;
  errors?: string[];
}

export class RustKuzuIngestor {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Ensure the directory exists for the database file
    const dbDir = dirname(dbPath);
    mkdirSync(dbDir, { recursive: true });
  }

  async initialize(): Promise<void> {
    // Perform handshake to ensure the Rust tool is ready and compatible
    await this.performHandshake();
  }

  private async performHandshake(): Promise<AckMessage> {
    console.log("🤝 Performing handshake with Rust kuzu-rust tool...");
    
    const result = await this.runRustCommand("handshake", []);
    console.log("🐛 Handshake raw result:", result);
    
    try {
      const ackMessage: AckMessage = JSON.parse(result);
      
      if (ackMessage.type !== "ack" || !ackMessage.ready) {
        throw new Error("Rust tool not ready or invalid handshake response");
      }
      
      console.log(`✅ Handshake successful - Rust tool v${ackMessage.version} ready`);
      console.log(`   Supported modes: ${ackMessage.supportedModes.join(", ")}`);
      
      return ackMessage;
    } catch (error) {
      console.error("🐛 Handshake parse error:", error);
      throw new Error(`Handshake failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ingest(analysisData: AnalysisData): Promise<IngestStats> {
    // Export graph data to temporary JSON file (zero conversion - direct format match!)
    const jsonPath = exportGraphToJson(analysisData);

    try {
      // Call Rust binary to ingest the JSON
      const result = await this.runRustCommand("ingest", [jsonPath, this.dbPath]);

      // Parse the structured JSON response
      const resultMessage = this.parseStructuredResult(result);
      
      if (!resultMessage.success) {
        throw new Error(`Ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`);
      }
      
      return resultMessage.stats;
    } finally {
      // Clean up temporary file
      try {
        rmSync(jsonPath, { force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Stream ingestion via stdio - faster, no temp files, real-time processing
   * This is the preferred method for most use cases
   */
  async ingestStream(
    analysisData: AnalysisData,
    batchSize: number = 500
  ): Promise<IngestStats> {
    console.log(`🚀 Starting streaming ingestion with batch size ${batchSize}`);

    return new Promise((resolve, reject) => {
      const process = spawn(RUST_BINARY_PATH, ["ingest-stream", this.dbPath], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", data => {
        stdout += data.toString();
        // Log any non-JSON progress messages
        const lines = data.toString().split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('{"type":')) {
            console.log(trimmed);
          }
        }
      });

      process.stderr.on("data", data => {
        stderr += data.toString();
        console.error("Rust stderr:", data.toString());
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
          } catch (error) {
            reject(new Error(`Failed to parse streaming result: ${error instanceof Error ? error.message : String(error)}`));
          }
        } else {
          reject(
            new Error(`Rust streaming ingestion failed with code ${code}: ${stderr}`)
          );
        }
      });

      process.on("error", error => {
        reject(
          new Error(`Failed to spawn Rust streaming process: ${error.message}`)
        );
      });

      // Stream data to stdin in batches
      this.streamDataToProcess(process, analysisData, batchSize).catch(reject);
    });
  }

  /**
   * Bulk ingestion using COPY FROM - fastest for large datasets
   * Use this for "ingest 10M edges before lunch" scenarios
   */
  async ingestBulk(analysisData: AnalysisData): Promise<IngestStats> {
    console.log(`🔥 Starting BULK ingestion (COPY FROM mode)`);

    return new Promise((resolve, reject) => {
      const process = spawn(RUST_BINARY_PATH, ["ingest-bulk", this.dbPath], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", data => {
        stdout += data.toString();
        console.log("Bulk progress:", data.toString().trim());
      });

      process.stderr.on("data", data => {
        stderr += data.toString();
        console.error("Rust stderr:", data.toString());
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
          } catch (error) {
            reject(new Error(`Failed to parse bulk result: ${error instanceof Error ? error.message : String(error)}`));
          }
        } else {
          reject(
            new Error(`Rust bulk ingestion failed with code ${code}: ${stderr}`)
          );
        }
      });

      process.on("error", error => {
        reject(new Error(`Failed to spawn Rust bulk process: ${error.message}`));
      });

      // Stream CSV data to stdin
      this.streamCSVToProcess(process, analysisData).catch(reject);
    });
  }

  async query(cypher: string): Promise<any[]> {
    const result = await this.runRustCommand("query", [cypher, this.dbPath]);
    return this.parseQueryOutput(result);
  }

  async close(): Promise<void> {
    // Nothing to do - Rust binary handles cleanup
  }

  private async runRustCommand(command: string, args: string[]): Promise<string> {
    console.log(
      `Running Rust command: ${RUST_BINARY_PATH} ${command} ${args.join(" ")}`
    );

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
        console.log(`Rust command finished with code ${code}`);
        console.log(`Stdout:`, stdout);
        if (stderr) console.log(`Stderr:`, stderr);

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Rust command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", error => {
        console.error(`Failed to spawn Rust process:`, error);
        reject(new Error(`Failed to spawn Rust process: ${error.message}`));
      });
    });
  }

  private parseStructuredResult(output: string): ResultMessage {
    try {
      // Find the JSON result line (might have other output before it)
      const lines = output.trim().split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{"type":"result"'));
      
      if (!jsonLine) {
        console.error("DEBUG: No JSON result found in output:");
        console.error("DEBUG: Output lines:", lines);
        throw new Error("No structured result found in output");
      }
      
      const result: ResultMessage = JSON.parse(jsonLine);
      
      if (result.type !== "result") {
        throw new Error("Invalid result message type");
      }
      
      return result;
    } catch (error) {
      console.error("DEBUG: Failed to parse result, raw output:", output);
      throw new Error(`Failed to parse structured result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseQueryOutput(output: string): any[] {
    // The Rust binary outputs query results in a table format
    // We need to parse this back into a JSON-like structure
    // For now, we'll do a simple parsing - this might need refinement

    const lines = output.trim().split("\n");
    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split("|").map(h => h.trim());
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split("|").map(v => v.trim());
      if (values.length === headers.length) {
        const row: any = {};
        for (let j = 0; j < headers.length; j++) {
          // Try to parse numbers
          const value = values[j];
          if (/^\d+$/.test(value)) {
            row[headers[j]] = parseInt(value, 10);
          } else {
            row[headers[j]] = value;
          }
        }
        results.push(row);
      }
    }

    return results;
  }

  /**
   * Stream analysis data to Rust process via stdin as NDJSON batches
   */
  private async streamDataToProcess(
    process: any,
    analysisData: AnalysisData,
    batchSize: number
  ): Promise<void> {
    const stdin = process.stdin;

    try {
      // Stream entities in batches
      console.log(
        `📦 Streaming ${analysisData.entities.length} entities in batches of ${batchSize}`
      );
      for (let i = 0; i < analysisData.entities.length; i += batchSize) {
        const batch = analysisData.entities.slice(i, i + batchSize);
        const ndjsonLine =
          JSON.stringify({
            type: "entities",
            data: batch
          }) + "\n";

        // Debug first batch only
        if (i === 0) {
          console.log("🐛 First entity batch sample:", batch.slice(0, 2));
        }

        if (!stdin.write(ndjsonLine)) {
          // Wait for drain if backpressure occurs
          await new Promise(resolve => stdin.once("drain", resolve));
        }
      }

      // Stream relationships by type in batches
      const relationshipsByType = new Map<
        string,
        typeof analysisData.relationships
      >();
      for (const rel of analysisData.relationships) {
        if (!relationshipsByType.has(rel.type)) {
          relationshipsByType.set(rel.type, []);
        }
        relationshipsByType.get(rel.type)!.push(rel);
      }

      console.log(
        `🔗 Streaming ${analysisData.relationships.length} relationships across ${relationshipsByType.size} types`
      );
      for (const [relType, rels] of relationshipsByType) {
        console.log(`   ${relType}: ${rels.length} relationships`);

        for (let i = 0; i < rels.length; i += batchSize) {
          const batch = rels.slice(i, i + batchSize);
          const ndjsonLine =
            JSON.stringify({
              type: "relationships",
              relationshipType: relType,
              data: batch
            }) + "\n";

          if (!stdin.write(ndjsonLine)) {
            await new Promise(resolve => stdin.once("drain", resolve));
          }
        }
      }

      // Signal end of stream
      const completeMessage = JSON.stringify({ type: "complete" }) + "\n";
      console.log("📤 Sending completion signal...");
      stdin.write(completeMessage);
      
      // Ensure all data is flushed before closing
      await new Promise(resolve => {
        if (stdin.writableEnded || stdin.destroyed) {
          resolve(void 0);
        } else {
          stdin.end(resolve);
        }
      });
    } catch (error) {
      stdin.destroy();
      throw error;
    }
  }

  /**
   * Stream analysis data as CSV for bulk COPY FROM ingestion
   */
  private async streamCSVToProcess(
    process: any,
    analysisData: AnalysisData
  ): Promise<void> {
    const stdin = process.stdin;

    try {
      // Stream entities CSV header + data
      stdin.write("ENTITIES_START\n");
      stdin.write(
        "id,kind,name,text,filePath,lineNum,colNum,startPos,endPos,nodeFlags\n"
      );

      for (const entity of analysisData.entities) {
        const csvLine =
          [
            this.escapeCsv(entity.id),
            this.escapeCsv(entity.kind),
            this.escapeCsv(entity.name),
            this.escapeCsv(entity.text),
            this.escapeCsv(entity.filePath),
            entity.line.toString(),
            entity.column.toString(),
            entity.pos.toString(),
            entity.end.toString(),
            entity.flags.toString()
          ].join(",") + "\n";

        if (!stdin.write(csvLine)) {
          await new Promise(resolve => stdin.once("drain", resolve));
        }
      }

      // Stream relationships by type
      const relationshipsByType = new Map<
        string,
        typeof analysisData.relationships
      >();
      for (const rel of analysisData.relationships) {
        if (!relationshipsByType.has(rel.type)) {
          relationshipsByType.set(rel.type, []);
        }
        relationshipsByType.get(rel.type)!.push(rel);
      }

      for (const [relType, rels] of relationshipsByType) {
        stdin.write(`RELATIONSHIPS_${relType}_START\n`);
        stdin.write("from,to,evidence,confidence,metadata\n");

        for (const rel of rels) {
          const csvLine =
            [
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
    } catch (error) {
      stdin.destroy();
      throw error;
    }
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
