import { spawn } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { dirname } from "path";
import { exportGraphToJson } from "../export/json-exporter.js";
import type { AnalysisData } from "../types.js";

const RUST_BINARY_PATH =
  process.env.KUZU_RUST_PATH || "/Users/zach/dev/kuzu-rust/target/release/kuzu-rust";

export interface IngestStats {
  entities: number;
  relationships: number;
  duration: number;
}

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
    const dbDir = dirname(dbPath);
    mkdirSync(dbDir, { recursive: true });
  }

  async initialize(): Promise<void> {
    await this.performHandshake();
  }

  private async performHandshake(): Promise<AckMessage> {
    const result = await this.runRustCommand("handshake", []);

    try {
      const ackMessage: AckMessage = JSON.parse(result);

      if (ackMessage.type !== "ack" || !ackMessage.ready) {
        throw new Error("Rust tool not ready or invalid handshake response");
      }

      return ackMessage;
    } catch (error) {
      throw new Error(
        `Handshake failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async ingest(analysisData: AnalysisData): Promise<IngestStats> {
    const jsonPath = exportGraphToJson(analysisData);

    try {
      const result = await this.runRustCommand("ingest", [jsonPath, this.dbPath]);
      const resultMessage = this.parseStructuredResult(result);

      if (!resultMessage.success) {
        throw new Error(
          `Ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`
        );
      }

      return resultMessage.stats;
    } finally {
      try {
        rmSync(jsonPath, { force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async ingestStream(
    analysisData: AnalysisData,
    batchSize: number = 1000
  ): Promise<IngestStats> {
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

          if (trimmed && !trimmed.startsWith('{"type":')) console.log(trimmed);
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
              reject(
                new Error(
                  `Streaming ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`
                )
              );
              return;
            }
            resolve(resultMessage.stats);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse streaming result: ${error instanceof Error ? error.message : String(error)}`
              )
            );
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

      this.streamDataToProcess(process, analysisData, batchSize).catch(reject);
    });
  }

  async ingestBulk(analysisData: AnalysisData): Promise<IngestStats> {
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
              reject(
                new Error(
                  `Bulk ingestion failed: ${resultMessage.errors?.join(", ") || "Unknown error"}`
                )
              );
              return;
            }
            resolve(resultMessage.stats);
          } catch (error) {
            reject(
              new Error(
                `Failed to parse bulk result: ${error instanceof Error ? error.message : String(error)}`
              )
            );
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
        if (stderr) console.log(`Stderr:`, stderr);

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Rust command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", error => {
        reject(new Error(`Failed to spawn Rust process: ${error.message}`));
      });
    });
  }

  private parseStructuredResult(output: string): ResultMessage {
    try {
      const lines = output.trim().split("\n");
      const jsonLine = lines.find(line =>
        line.trim().startsWith('{"type":"result"')
      );

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
      throw new Error(
        `Failed to parse structured result: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseQueryOutput(output: string): any[] {
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

  private async streamDataToProcess(
    process: any,
    analysisData: AnalysisData,
    batchSize: number
  ): Promise<void> {
    const stdin = process.stdin;

    try {
      for (let i = 0; i < analysisData.entities.length; i += batchSize) {
        const batch = analysisData.entities.slice(i, i + batchSize);
        const ndjsonLine =
          JSON.stringify({
            type: "entities",
            data: batch
          }) + "\n";

        if (!stdin.write(ndjsonLine)) {
          await new Promise(resolve => stdin.once("drain", resolve));
        }
      }

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

      const completeMessage = JSON.stringify({ type: "complete" }) + "\n";
      stdin.write(completeMessage);
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
