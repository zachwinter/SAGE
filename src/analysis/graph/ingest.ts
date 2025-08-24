import kuzu from "kuzu";
import { createHash } from "crypto";
import { relative } from "path";
import { analyzeFiles, getCodeFiles } from "../index.js";
import type { FileAnalysisResult, CodeEntity, CallExpression } from "../types.js";
import {
  KUZU_SCHEMA_COMMANDS,
  type GraphEntity,
  type GraphRelationship
} from "./schema.js";

export class KuzuGraphIngestor {
  private db: any;
  private conn: any;

  constructor(private dbPath: string) {}

  async initialize() {
    this.db = new kuzu.Database(this.dbPath);
    this.conn = new kuzu.Connection(this.db);

    for (const command of KUZU_SCHEMA_COMMANDS) {
      try {
        await this.conn.query(command);
      } catch (error: any) {
        // Ignore "already exists" errors, but warn for others.
        if (!error.message.includes("already exists")) {
          console.warn(`Schema creation warning: ${error.message}`);
        }
      }
    }
  }

  async ingestProject(projectPath: string) {
    const startTime = performance.now();
    const files = getCodeFiles(projectPath);
    const analysisResults = analyzeFiles(files, {
      calls: true,
      types: true
    });
    const { entities, relationships } = this.convertToGraph(analysisResults);
    await this.ingestEntities(entities);
    await this.ingestRelationships(relationships);
    await this.ingestFiles(analysisResults);
    const endTime = performance.now();
    const duration = endTime - startTime;
    return {
      entities: entities.length,
      relationships: relationships.length,
      duration
    };
  }

  private convertToGraph(analysisResults: FileAnalysisResult[]): {
    entities: GraphEntity[];
    relationships: GraphRelationship[];
  } {
    const entities: GraphEntity[] = [];
    const relationships: GraphRelationship[] = [];

    for (const fileResult of analysisResults) {
      // Convert code entities
      for (const entity of fileResult.entities) {
        const graphEntity = this.convertEntity(entity, fileResult.filePath);
        entities.push(graphEntity);
      }

      // Convert call expressions to CALLS relationships
      for (const callExpr of fileResult.callExpressions || []) {
        const relationship = this.convertCallExpression(
          callExpr,
          fileResult.filePath
        );
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }
    return { entities, relationships };
  }

  private convertEntity(entity: CodeEntity, filePath: string): GraphEntity {
    const id = this.createEntityId(entity, filePath);

    return {
      id,
      kind: entity.type,
      name: entity.name,
      text: entity.signature,
      filePath: relative(process.cwd(), filePath),
      line: entity.line,
      // Default values for properties that may not be available from the analyzer
      column: entity.column ?? 0,
      pos: entity.pos ?? 0,
      end: entity.end ?? 0,
      flags: 0 // Placeholder for future use
    };
  }

  private convertCallExpression(
    callExpr: CallExpression,
    filePath: string
  ): GraphRelationship | null {
    if (!callExpr.containingFunction) return null;
    const callerId = this.createFunctionId(callExpr.containingFunction, filePath);
    const calleeId = this.createFunctionId(callExpr.callee, filePath);
    const metadata = {
      argumentCount: String(callExpr.argumentCount),
      signature: callExpr.signature,
      line: String(callExpr.line)
    };

    return {
      from: callerId,
      to: calleeId,
      type: "CALLS",
      evidence: callExpr.type === "method" ? "Method call" : "Direct function call",
      confidence: "high",
      metadata
    };
  }

  private createEntityId(entity: CodeEntity, filePath: string): string {
    const relativePath = relative(process.cwd(), filePath);
    // Using a template literal for clean string construction
    const input = `${relativePath}:${entity.type}:${entity.name}:${entity.line}`;
    return createHash("sha256").update(input).digest("hex").substring(0, 16);
  }

  private createFunctionId(functionName: string, filePath: string): string {
    const relativePath = relative(process.cwd(), filePath);
    // Using a template literal for clean string construction
    const input = `${relativePath}:function:${functionName}`;
    return createHash("sha256").update(input).digest("hex").substring(0, 16);
  }

  private async ingestEntities(entities: GraphEntity[]) {
    try {
      await this.conn.query("BEGIN TRANSACTION;");
      const preparedStatement = await this.conn.prepare(`
        MERGE (n:CodeEntity {id: $id})
        SET n.kind = $kind,
            n.name = $name,
            n.text = $text,
            n.filePath = $filePath,
            n.lineNum = $lineNum,
            n.colNum = $colNum,
            n.startPos = $startPos,
            n.endPos = $endPos,
            n.nodeFlags = $nodeFlags
      `);

      for (const entity of entities) {
        try {
          await this.conn.execute(preparedStatement, {
            id: entity.id,
            kind: entity.kind,
            name: entity.name,
            text: entity.text,
            filePath: entity.filePath,
            lineNum: entity.line,
            colNum: entity.column,
            startPos: entity.pos,
            endPos: entity.end,
            nodeFlags: entity.flags
          });
        } catch (error: any) {
          console.warn(
            `Entity ingestion error for ID ${entity.id}: ${error.message}`
          );
        }
      }

      await this.conn.query("COMMIT;");
    } catch (error) {
      // it's fine for now
    }
  }

  private async ingestRelationships(relationships: GraphRelationship[]) {
    try {
      await this.conn.query("BEGIN TRANSACTION;");

      const preparedStatement = await this.conn.prepare(`
        MATCH (a:CodeEntity {id: $from}), (b:CodeEntity {id: $to})
        CREATE (a)-[:CALLS {
          evidence: $evidence,
          confidence: $confidence,
          isAsync: false,
          metadata: $metadata
        }]->(b)
      `);

      for (const rel of relationships) {
        if (rel.type === "CALLS") {
          try {
            await this.conn.execute(preparedStatement, {
              from: rel.from,
              to: rel.to,
              evidence: rel.evidence,
              confidence: rel.confidence,
              metadata: rel.metadata
            });
          } catch (error: any) {
            console.warn(
              `Failed to ingest relationship from ${rel.from} to ${rel.to}:`,
              error.message
            );
          }
        }
      }

      await this.conn.query("COMMIT;");
    } catch (error) {
      // it's fine for now
    }
  }

  private async ingestFiles(analysisResults: FileAnalysisResult[]) {
    try {
      await this.conn.query("BEGIN TRANSACTION;");

      const preparedStatement = await this.conn.prepare(`
        CREATE (:SourceFile {
          path: $path,
          extension: $extension,
          size: 0,
          totalLines: $totalLines,
          entityCount: $entityCount,
          relationshipCount: $relationshipCount
        })
      `);

      for (const fileResult of analysisResults) {
        const relativePath = relative(process.cwd(), fileResult.filePath);
        const extension = relativePath.split(".").pop() || "";
        try {
          await this.conn.execute(preparedStatement, {
            path: relativePath,
            extension: extension,
            totalLines: fileResult.totalLines,
            entityCount: fileResult.entities.length,
            relationshipCount: fileResult.callExpressions?.length || 0
          });
        } catch (error: any) {
          if (!error.message.includes("already exists")) {
            console.warn(
              `File ingestion error for ${relativePath}: ${error.message}`
            );
          }
        }
      }

      await this.conn.query("COMMIT;");
    } catch (error) {
      // it's fine for now
    }
  }

  async query(cypher: string) {
    const result = await this.conn.query(cypher);
    return await result.getAll();
  }

  async close() {
    if (this.db) {
      if (typeof (this.db as any).shutdown === "function") {
        (this.db as any).shutdown();
      } else if (typeof (this.db as any)._destroy === "function") {
        (this.db as any)._destroy();
      } else if (typeof (this.db as any).close === "function") {
        (this.db as any).close();
      }
      this.db = null;
      this.conn = null;
    }
  }
}
