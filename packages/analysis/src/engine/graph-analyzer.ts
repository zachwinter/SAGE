import { createHash } from "crypto";
import { relative, dirname, resolve } from "path";
import { analyzeFiles } from "./analyzer.js";
import { 
  parseProjectInfo, 
  findPackages, 
  identifyApplications, 
  createProjectEntity, 
  createApplicationEntity, 
  createPackageEntity 
} from "./project-parser.js";
import {
  extractDependencies,
  loadExternalPackageInfo,
  createDependencyEntity,
  createPackageDependencyRelationships,
  findUsedDependencies
} from "./dependency-parser.js";
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
  
  // Determine project root (assume all files are in same project)
  const projectRoot = process.cwd();
  
  // Parse project structure (Project -> Applications -> Packages)
  const projectInfo = parseProjectInfo(projectRoot);
  let projectEntity: GraphEntity | null = null;
  let applicationEntities: GraphEntity[] = [];
  let packageEntities: GraphEntity[] = [];
  
  if (projectInfo) {
    // Find all packages in the project
    const packages = findPackages(projectInfo, projectRoot);
    const applications = identifyApplications(packages);
    
    // Create Project root entity
    projectEntity = createProjectEntity(projectInfo, projectRoot, {
      totalFiles: files.length,
      totalEntities: fileResults.reduce((sum, fr) => sum + fr.entities.length, 0),
      totalPackages: packages.length,
      totalApplications: applications.length
    });
    entities.push(projectEntity);
    
    // Create Application entities
    for (const appInfo of applications) {
      const appEntity = createApplicationEntity(appInfo, projectRoot);
      applicationEntities.push(appEntity);
      entities.push(appEntity);
    }
    
    // Create Package entities
    for (const pkgInfo of packages) {
      const pkgEntity = createPackageEntity(pkgInfo, projectRoot);
      packageEntities.push(pkgEntity);
      entities.push(pkgEntity);
    }
    
    // Create Dependency entities (if includeDeps is enabled)
    if (options.includeDeps) {
      const dependencies = extractDependencies(packages);
      console.log(`🔗 Found ${dependencies.length} unique dependencies`);
      
      // Filter out workspace dependencies - they're already modeled as packages
      const externalDeps = dependencies.filter(d => !d.isWorkspaceDependency);
      
      for (const dep of externalDeps) {
        // Load external package info if available
        const externalInfo = loadExternalPackageInfo(dep.name, projectRoot);
        const depEntity = createDependencyEntity(dep, externalInfo, projectRoot);
        entities.push(depEntity);
      }
      
      console.log(`📦 Added ${externalDeps.length} external dependency entities`);
    }
  }
  
  // First pass: Create SourceFile entities (for imports/entry points) and CodeEntity entities
  const fileEntities = new Map<string, GraphEntity>(); // Track SourceFile entities
  
  for (const fileResult of fileResults) {
    const relativePath = relative(process.cwd(), fileResult.filePath);
    
    // Create SourceFile entity (needed for imports and entry points)
    const sourceFileEntity: GraphEntity = {
      id: createSourceFileId(relativePath),
      kind: "SourceFile",
      name: relativePath,
      text: `// Source file: ${relativePath}`,
      filePath: relativePath,
      line: 1,
      column: 0,
      pos: 0,
      end: 0,
      flags: 0
    };
    entities.push(sourceFileEntity);
    fileEntities.set(relativePath, sourceFileEntity);
    
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
  
  // Create Project hierarchy relationships
  if (projectEntity && projectInfo) {
    const packages = findPackages(projectInfo, projectRoot);
    const applications = identifyApplications(packages);
    
    // Project -> Application relationships
    for (const appEntity of applicationEntities) {
      relationships.push({
        from: projectEntity.id,
        to: appEntity.id,
        type: "HAS_APPLICATION",
        evidence: `Project contains application ${appEntity.name}`,
        confidence: "high",
        metadata: {
          applicationType: (appEntity as any).applicationType
        }
      });
    }
    
    // Project -> Package relationships  
    for (const pkgEntity of packageEntities) {
      relationships.push({
        from: projectEntity.id,
        to: pkgEntity.id,
        type: "HAS_PACKAGE",
        evidence: `Project contains package ${pkgEntity.name}`,
        confidence: "high",
        metadata: {
          version: (pkgEntity as any).version
        }
      });
    }
    
    // Application -> Entry Point relationships
    for (let i = 0; i < applications.length; i++) {
      const appInfo = applications[i];
      const appEntity = applicationEntities[i];
      
      for (const entryPointPath of appInfo.entryPoints) {
        const relativePath = relative(projectRoot, entryPointPath);
        const sourceFileEntity = fileEntities.get(relativePath);
        
        if (sourceFileEntity) {
          relationships.push({
            from: appEntity.id,
            to: sourceFileEntity.id,
            type: "HAS_ENTRYPOINT",
            evidence: `Application entry point: ${relativePath}`,
            confidence: "high",
            metadata: {
              entryType: entryPointPath === resolve(projectRoot, appInfo.main || '') ? 'main' : 
                         entryPointPath === resolve(projectRoot, appInfo.types || '') ? 'types' : 'bin'
            }
          });
        }
      }
    }
    
    // Create dependency relationships (Package -> Dependency)
    if (options.includeDeps) {
      const packages = findPackages(projectInfo, projectRoot);
      const dependencies = extractDependencies(packages);
      const externalDeps = dependencies.filter(d => !d.isWorkspaceDependency);
      
      // Get dependency entities we just created
      const dependencyEntities = entities.filter(e => e.kind === 'Dependency');
      
      // Create Package -> Dependency relationships
      const depRelationships = createPackageDependencyRelationships(
        packages, 
        externalDeps, 
        dependencyEntities, 
        packageEntities
      );
      relationships.push(...depRelationships);
      
      // INSANE MODE: Create Import -> Dependency relationships
      const usageRelationships = findUsedDependencies(entities, dependencies);
      relationships.push(...usageRelationships);
      
      console.log(`🔗 Created ${depRelationships.length} package dependency relationships`);
      console.log(`📤 Created ${usageRelationships.length} import usage relationships`);
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

/**
 * Create a unique SourceFile ID
 */
function createSourceFileId(filePath: string): string {
  const input = `SourceFile:${filePath}`;
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

