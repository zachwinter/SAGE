import { createHash } from "crypto";
import { relative, dirname, resolve } from "path";
import { analyzeFiles } from "./analyzer.js";
import type { AnalysisData, GraphEntity, GraphRelationship, AnalysisOptions } from "../types.js";

/**
 * Analyze files and return graph-native format (entities + relationships)
 * This is the superior format that matches Rust expectations exactly
 */
export function analyzeToGraph(
  files: string[],
  options: AnalysisOptions = {}
): AnalysisData {
  // Use existing analyzer to get file-based results
  const fileResults = analyzeFiles(files, options);
  
  const entities: GraphEntity[] = [];
  const relationships: GraphRelationship[] = [];
  
  // First pass: Create CodeEntity entities (no more SourceFile clutter!)
  for (const fileResult of fileResults) {
    const relativePath = relative(process.cwd(), fileResult.filePath);
    
    // Convert code entities to graph entities
    for (const entity of fileResult.entities) {
      const graphEntity: GraphEntity = {
        id: entity.id || createEntityId(entity, relativePath), // Use entity's ID if available
        kind: entity.type, 
        name: entity.name,
        text: entity.signature,
        filePath: relativePath,
        line: entity.line,
        column: entity.column ?? 0,
        pos: entity.pos ?? 0, 
        end: entity.end ?? 0,
        flags: 0,
        parentScopeId: entity.parentScopeId // Preserve scope information!
      };
      entities.push(graphEntity);
    }
  }
  
  // Second pass: Create relationships between entities
  for (const fileResult of fileResults) {
    const relativePath = relative(process.cwd(), fileResult.filePath);
    
    // Convert call expressions to CALLS relationships
    for (const callExpr of fileResult.callExpressions || []) {
      if (!callExpr.containingFunction) continue;
      
      // Find the actual entity IDs from our entities list
      const fromEntity = entities.find(e => 
        e.name === callExpr.containingFunction && 
        e.filePath === relativePath &&
        e.kind !== "SourceFile"
      );
      
      // Try to find callee in same file first, then any file
      let toEntity = entities.find(e => 
        e.name === callExpr.callee && 
        e.filePath === relativePath &&
        e.kind !== "SourceFile"
      );
      
      if (!toEntity) {
        // Look for callee in other files (cross-file calls)
        toEntity = entities.find(e => 
          e.name === callExpr.callee && 
          e.kind !== "SourceFile"
        );
      }
      
      if (fromEntity && toEntity) {
        const relationship: GraphRelationship = {
          from: fromEntity.id,
          to: toEntity.id,
          type: "CALLS",
          evidence: callExpr.type === "method" ? "Method call" : "Direct function call",
          confidence: "high",
          metadata: {
            argumentCount: callExpr.argumentCount.toString(),
            signature: callExpr.signature,
            line: callExpr.line.toString()
          }
        };
        relationships.push(relationship);
      }
    }
    
    // Handle exports - create EXPORTS relationships
    for (const entity of fileResult.entities) {
      // Case 1: Separate export entities (export default, export { named })  
      if (entity.type === "export") {
        const exportEntity = entities.find(e => 
          e.name === entity.name && 
          e.filePath === relativePath &&
          e.kind === "export"
        );
        
        if (exportEntity && !("isReExport" in entity && entity.isReExport)) {
          let exportedName = entity.name;
          
          // Handle "default (functionName)" format
          if (exportedName.startsWith("default (") && exportedName.endsWith(")")) {
            exportedName = exportedName.slice(9, -1);
          } else if (exportedName === "default") {
            continue; // Skip pure default exports for now
          }
          
          const exportedEntity = entities.find(e => 
            e.name === exportedName && 
            e.filePath === relativePath &&
            e.kind !== "export" && e.kind !== "import"
          );
          
          if (exportedEntity) {
            relationships.push({
              from: exportedEntity.id,
              to: exportEntity.id,
              type: "EXPORTS",
              evidence: `${exportedEntity.name} is exported via separate export statement`,
              confidence: "high",
              metadata: {
                exportType: ("exportType" in entity ? entity.exportType : "unknown") || "unknown",
                isDefault: ("isDefault" in entity ? entity.isDefault : false) || false
              }
            });
          }
        }
      }
      
      // Case 2: Inline exports (export function foo, export class Bar)
      else if ("isExported" in entity && entity.isExported) {
        const exportedEntity = entities.find(e => 
          e.name === entity.name && 
          e.filePath === relativePath &&
          e.kind === entity.type
        );
        
        if (exportedEntity) {
          // Create a virtual export node for inline exports
          const virtualExportId = `export_${exportedEntity.id}`;
          const virtualExport: GraphEntity = {
            id: virtualExportId,
            kind: "export", 
            name: `export:${entity.name}`,
            text: `export ${entity.type} ${entity.name}`,
            filePath: relativePath,
            line: entity.line,
            column: 0,
            pos: 0,
            end: 0,
            flags: 0
          };
          entities.push(virtualExport);
          
          relationships.push({
            from: exportedEntity.id,
            to: virtualExportId,
            type: "EXPORTS",
            evidence: `${entity.name} is exported inline`,
            confidence: "high",
            metadata: {
              exportType: "named",
              isDefault: false,
              isInline: true
            }
          });
        }
      }
    }
    
    // Create scope-based CONTAINS relationships
    for (const entity of fileResult.entities) {
      if (entity.parentScopeId) {
        // Find the parent entity by its ID
        const parentEntity = entities.find(e => e.id && e.id === entity.parentScopeId);
        const childEntity = entities.find(e => 
          e.name === entity.name && 
          e.filePath === relativePath &&
          e.kind === entity.type &&
          e.line === entity.line
        );
        
        if (parentEntity && childEntity) {
          relationships.push({
            from: parentEntity.id,
            to: childEntity.id,
            type: "CONTAINS",
            evidence: `${parentEntity.name} lexically contains ${childEntity.name}`,
            confidence: "high",
            metadata: {
              scopeType: parentEntity.kind,
              containedType: childEntity.kind,
              isLexicalScope: true
            }
          });
        }
      }
    }
  }
  
  return {
    entities,
    relationships
  };
}

/**
 * Create a unique entity ID
 */
function createEntityId(entity: any, filePath: string): string {
  const input = `${filePath}:${entity.type}:${entity.name}:${entity.line}`;
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

