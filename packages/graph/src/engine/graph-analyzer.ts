import chalk from "chalk";
import { dirname, extname, relative, resolve } from "path";
import {
  createFirstClassEntity,
  createSourceFileId,
  isRelationshipAllowed,
  getEntityKind
} from "../index.js";
import type {
  AnalysisData,
  AnalysisOptions,
  GraphEntity,
  GraphRelationship
} from "../types.js";
import { analyzeFiles } from "./analyzer.js";
import {
  createDependencyEntity,
  createPackageDependencyRelationships,
  extractDependencies,
  findUsedDependencies,
  loadExternalPackageInfo
} from "./dependency-parser.js";
import {
  createApplicationEntity,
  createPackageEntity,
  createProjectEntity,
  findPackages,
  identifyApplications,
  parseProjectInfo
} from "./project-parser.js";

const line = chalk.magenta("│");

/**
 * Analyze files and return graph-native format (entities + relationships)
 * This is the superior format that matches Rust expectations exactly
 */
export function analyzeToGraph(
  files: string[],
  options: AnalysisOptions = {}
): AnalysisData {
  const { debug = false } = options;

  if (debug) console.log(line, "Starting graph analysis...");

  // Use existing analyzer to get file-based results
  const fileResults = analyzeFiles(files, options);

  const entities: GraphEntity[] = [];
  const relationships: GraphRelationship[] = [];

  if (debug) {
    const totalEntities = fileResults.reduce(
      (sum, fr) => sum + fr.entities.length,
      0
    );
    const totalCalls = fileResults.reduce(
      (sum, fr) => sum + fr.callExpressions.length,
      0
    );
    console.log(
      line,
      `File analysis complete: ${totalEntities} total entities, ${totalCalls} total calls`
    );
  }

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
      console.log(line, ` Found ${dependencies.length} unique dependencies`);

      // Filter out workspace dependencies - they're already modeled as packages
      const externalDeps = dependencies.filter(d => !d.isWorkspaceDependency);

      for (const dep of externalDeps) {
        // Load external package info if available
        const externalInfo = loadExternalPackageInfo(dep.name, projectRoot);
        const depEntity = createDependencyEntity(dep, externalInfo, projectRoot);
        entities.push(depEntity);
      }

      console.log(
        line,
        ` Added ${externalDeps.length} external dependency entities`
      );
    }
  }

  // First pass: Create first-class entities, then SourceFile entities with proper counts
  const fileEntities = new Map<string, GraphEntity>(); // Track SourceFile entities
  const entityCache = new Map<string, GraphEntity[]>(); // Cache entities by file path for faster lookups

  for (const fileResult of fileResults) {
    const relativePath = relative(process.cwd(), fileResult.filePath);

    // Convert code entities to first-class graph entities
    const fileCodeEntities: GraphEntity[] = [];
    for (const entity of fileResult.entities) {
      const graphEntity = createFirstClassEntity(entity, relativePath);
      entities.push(graphEntity);
      fileCodeEntities.push(graphEntity);
    }

    // Get file extension and detect if module has imports/exports
    const fileExtension = extname(relativePath).substring(1); // Remove the dot
    const totalLines =
      fileResult.totalLines ||
      (fileResult.entities.length > 0
        ? Math.max(...fileResult.entities.map(e => e.line || 1))
        : 1);

    // Detect if this file is a module (has imports or exports)
    const hasImportsOrExports = fileResult.entities.some(
      e =>
        e.type === "import" ||
        e.type === "export" ||
        ("isExported" in e && e.isExported)
    );

    // Create SourceFile entity with proper counts and isModule flag
    const sourceFileEntity: GraphEntity = {
      id: createSourceFileId(relativePath),
      kind: "SourceFile",
      name: relativePath,
      text: `// Source file: ${relativePath}`,
      filePath: relativePath,
      line: 1,
      column_num: 0,
      pos: 0,
      end: 0,
      flags: 0,
      extension: fileExtension,
      isModule: hasImportsOrExports,
      entityCount: fileCodeEntities.length,
      totalLines: totalLines,
      relationshipCount: 0 // Will be calculated later
    };
    entities.push(sourceFileEntity);
    fileEntities.set(relativePath, sourceFileEntity);

    // Cache entities by file path for faster lookups
    entityCache.set(relativePath, fileCodeEntities);
  }

  // Track skipped relationships for debug output
  const skippedRelationships = new Map<string, number>();

  // Second pass: Create relationships between entities
  for (const fileResult of fileResults) {
    const relativePath = relative(process.cwd(), fileResult.filePath);

    // Convert call expressions to CALLS relationships
    for (const callExpr of fileResult.callExpressions || []) {
      // Use cached entities for faster lookups
      const cachedFileEntities = entityCache.get(relativePath) || [];
      
      // Determine the "from" entity - either a function or the source file itself
      let fromEntity: GraphEntity | undefined;
      if (callExpr.containingFunction) {
        // Call within a function/method
        fromEntity = cachedFileEntities.find(
          e => e.name === callExpr.containingFunction
        );
      } else {
        // Top-level call - from SourceFile
        fromEntity = fileEntities.get(relativePath);
      }

      // Try to find callee in same file first
      let toEntity = cachedFileEntities.find(e => e.name === callExpr.callee);

      if (!toEntity) {
        // Look for callee in other files (cross-file calls) - only if needed
        toEntity = entities.find(
          e => e.name === callExpr.callee && e.kind !== "SourceFile"
        );
      }

      if (fromEntity && toEntity) {
        // Validate CALLS relationship schema before creating it
        if (isRelationshipAllowed("CALLS", fromEntity.kind, toEntity.kind)) {
          const relationship: GraphRelationship = {
            from: fromEntity.id,
            to: toEntity.id,
            fromKind: fromEntity.kind,
            toKind: toEntity.kind,
            type: "CALLS",
            evidence:
              callExpr.type === "method" ? "Method call" : "Direct function call",
            confidence: "high",
            metadata: {
              argumentCount: callExpr.argumentCount.toString(),
              signature: callExpr.signature,
              line: callExpr.line.toString()
            }
          };
          relationships.push(relationship);
        } else if (debug) {
          const key = `CALLS:${fromEntity.kind}->${toEntity.kind}`;
          skippedRelationships.set(key, (skippedRelationships.get(key) || 0) + 1);
        }
      }
    }

    // Handle exports - create EXPORTS relationships (SourceFile -> exported entities)
    let sourceFileEntity = fileEntities.get(relativePath);
    if (sourceFileEntity) {
      if (debug && relativePath.includes('index.ts')) {
        console.log(`DEBUG EXPORTS: Processing exports for ${relativePath}`);
        console.log(`DEBUG EXPORTS: SourceFile entity:`, sourceFileEntity.id, sourceFileEntity.name);
      }
      for (const entity of fileResult.entities) {
        // Check if entity is exported (either inline export or via export statement)
        let isExported = false;
        let exportType = "named";
        
        if ("isExported" in entity && entity.isExported) {
          // Case 1: Inline exports (export function foo, export class Bar)
          isExported = true;
          exportType = "named";
        } else if (entity.type === "export" && !("isReExport" in entity && entity.isReExport)) {
          // Case 2: Separate export entities (export default, export { named })
          // For these, we want to find the original entity being exported
          let exportedName = entity.name;
          
          // Handle "default (functionName)" format
          if (exportedName.startsWith("default (") && exportedName.endsWith(")")) {
            exportedName = exportedName.slice(9, -1);
            exportType = "default";
          } else if (exportedName === "default") {
            continue; // Skip pure default exports for now
          }
          
          // Find the original entity being exported
          const cachedFileEntities = entityCache.get(relativePath) || [];
          const originalEntity = cachedFileEntities.find(
            e =>
              e.name === exportedName && 
              e.kind !== getEntityKind("export") && 
              e.kind !== getEntityKind("import")
          );
          
          if (originalEntity) {
            // Create SourceFile -> original entity EXPORTS relationship
            if (isRelationshipAllowed("EXPORTS", sourceFileEntity.kind, originalEntity.kind)) {
              const exportsRel = {
                from: sourceFileEntity.id,
                to: originalEntity.id,
                fromKind: sourceFileEntity.kind,
                toKind: originalEntity.kind,
                type: "EXPORTS",
                evidence: `File ${relativePath} exports ${originalEntity.name} via export statement`,
                confidence: "high" as const,
                metadata: {
                  exportType: exportType,
                  isDefault: exportType === "default",
                  exportedName: entity.name
                }
              };
              relationships.push(exportsRel);
              
              if (debug && relativePath.includes('index.ts')) {
                console.log(`DEBUG EXPORTS: Created relationship:`, exportsRel);
              }
            } else if (debug) {
              const key = `EXPORTS:${sourceFileEntity.kind}->${originalEntity.kind}`;
              skippedRelationships.set(key, (skippedRelationships.get(key) || 0) + 1);
            }
          }
          continue; // Skip further processing for export entities
        }
        
        if (isExported) {
          // Create SourceFile -> exported entity relationship for inline exports
          const cachedFileEntities = entityCache.get(relativePath) || [];
          const exportedEntity = cachedFileEntities.find(
            e => e.name === entity.name && e.kind === getEntityKind(entity.type)
          );

          if (exportedEntity && isRelationshipAllowed("EXPORTS", sourceFileEntity.kind, exportedEntity.kind)) {
            const inlineExportsRel = {
              from: sourceFileEntity.id,
              to: exportedEntity.id,
              fromKind: sourceFileEntity.kind,
              toKind: exportedEntity.kind,
              type: "EXPORTS",
              evidence: `File ${relativePath} exports ${entity.name} inline`,
              confidence: "high" as const,
              metadata: {
                exportType: exportType,
                isDefault: false,
                isInline: true
              }
            };
            relationships.push(inlineExportsRel);
            
            if (debug && relativePath.includes('index.ts')) {
              console.log(`DEBUG EXPORTS: Created inline relationship:`, inlineExportsRel);
            }
          } else if (debug && exportedEntity) {
            const key = `EXPORTS:${sourceFileEntity.kind}->${exportedEntity.kind}`;
            skippedRelationships.set(key, (skippedRelationships.get(key) || 0) + 1);
          }
        }
      }
    }

    // Create scope-based CONTAINS relationships
    for (const entity of fileResult.entities) {
      if (entity.parentScopeId) {
        // Find the parent entity by its ID
        const parentEntity = entities.find(
          e => e.id && e.id === entity.parentScopeId
        );
        const cachedFileEntities = entityCache.get(relativePath) || [];
        const childEntity = cachedFileEntities.find(
          e =>
            e.name === entity.name &&
            e.kind === getEntityKind(entity.type) &&
            e.line === entity.line
        );

        if (parentEntity && childEntity) {
          // Validate CONTAINS relationship schema
          if (
            isRelationshipAllowed("CONTAINS", parentEntity.kind, childEntity.kind)
          ) {
            relationships.push({
              from: parentEntity.id,
              to: childEntity.id,
              fromKind: parentEntity.kind,
              toKind: childEntity.kind,
              type: "CONTAINS",
              evidence: `${parentEntity.name} lexically contains ${childEntity.name}`,
              confidence: "high",
              metadata: {
                scopeType: parentEntity.kind,
                containedType: childEntity.kind,
                isLexicalScope: true
              }
            });
          } else if (debug) {
            const key = `CONTAINS:${parentEntity.kind}->${childEntity.kind}`;
            skippedRelationships.set(key, (skippedRelationships.get(key) || 0) + 1);
          }
        }
      }
    }

    // Create file-level CONTAINS relationships (SourceFile -> CodeEntity for top-level entities)
    // sourceFileEntity already declared above
    if (sourceFileEntity) {
      if (debug && relativePath.includes('errors.ts')) {
        console.log(`DEBUG: Processing file ${relativePath}, sourceFile entity:`, sourceFileEntity.name);
        console.log(`DEBUG: File has ${fileResult.entities.length} entities`);
      }
      
      for (const entity of fileResult.entities) {
        // Only create CONTAINS for top-level entities (those without parentScopeId)
        if (!entity.parentScopeId) {
          const cachedFileEntities = entityCache.get(relativePath) || [];
          const codeEntity = cachedFileEntities.find(
            e =>
              e.name === entity.name &&
              e.kind === getEntityKind(entity.type) &&
              e.line === entity.line
          );

          if (debug && relativePath.includes('errors.ts')) {
            console.log(`DEBUG: Top-level entity ${entity.name} (${entity.type}), found codeEntity:`, !!codeEntity);
            if (codeEntity) {
              console.log(`DEBUG: Would create CONTAINS: ${sourceFileEntity.kind} -> ${codeEntity.kind}`);
            }
          }

          if (codeEntity) {
            // Validate SourceFile CONTAINS relationship schema
            if (
              isRelationshipAllowed(
                "CONTAINS",
                sourceFileEntity.kind,
                codeEntity.kind
              )
            ) {
              relationships.push({
                from: sourceFileEntity.id,
                to: codeEntity.id,
                fromKind: sourceFileEntity.kind,
                toKind: codeEntity.kind,
                type: "CONTAINS",
                evidence: `File ${relativePath} contains top-level ${entity.type} ${entity.name}`,
                confidence: "high" as const,
                metadata: {
                  scopeType: "file",
                  containedType: entity.type,
                  isTopLevel: true
                }
              });
              
              if (debug && relativePath.includes('errors.ts')) {
                console.log(`DEBUG: Created CONTAINS relationship for ${entity.name}`);
              }
            } else if (debug) {
              const key = `CONTAINS:${sourceFileEntity.kind}->${codeEntity.kind}`;
              skippedRelationships.set(
                key,
                (skippedRelationships.get(key) || 0) + 1
              );
              if (relativePath.includes('errors.ts')) {
                console.log(`DEBUG: CONTAINS relationship rejected: ${sourceFileEntity.kind} -> ${codeEntity.kind}`);
              }
            }
          }
        }
      }
    }

    // Create IMPORTS relationships from import statements
    for (const entity of fileResult.entities) {
      if (entity.type === "import" && "module" in entity && (entity as any).module) {
        // Find the import entity we created using cached entities
        const cachedFileEntities = entityCache.get(relativePath) || [];
        const importEntity = cachedFileEntities.find(
          e =>
            e.name === entity.name && e.kind === "ImportAlias" && e.line === entity.line
        );

        if (importEntity) {
          const moduleSpecifier = (entity as any).module;

          // Store the module specifier in the import entity for later dependency matching
          (importEntity as any).moduleSpecifier = moduleSpecifier;

          // Handle local vs external imports without expensive file system operations
          if (moduleSpecifier.startsWith(".")) {
            const currentFileDir = dirname(fileResult.filePath);
            const absoluteImportPath = resolve(currentFileDir, moduleSpecifier);
            const relativeImportPath = relative(process.cwd(), absoluteImportPath);

            const toEntity =
              fileEntities.get(relativeImportPath) ||
              fileEntities.get(`${relativeImportPath}.ts`) ||
              fileEntities.get(`${relativeImportPath}.js`);

            if (toEntity) {
              // Validate local IMPORTS relationship schema
              if (
                isRelationshipAllowed("IMPORTS", importEntity.kind, toEntity.kind)
              ) {
                relationships.push({
                  from: importEntity.id,
                  to: toEntity.id,
                  fromKind: importEntity.kind,
                  toKind: toEntity.kind,
                  type: "IMPORTS",
                  evidence: `Local import statement: ${moduleSpecifier}`,
                  confidence: "high" as const,
                  metadata: {
                    module: moduleSpecifier,
                    importType: "local",
                    resolvedPath: toEntity.filePath,
                    sourceFile: relativePath
                  }
                });
              } else if (debug) {
                const key = `IMPORTS:${importEntity.kind}->${toEntity.kind}`;
                skippedRelationships.set(
                  key,
                  (skippedRelationships.get(key) || 0) + 1
                );
              }
            } else {
              // Could not resolve, skip creating relationship to avoid schema violations
              // TODO: Create placeholder SourceFile entities for unresolved imports
              // relationships.push({
              //   from: importEntity.id,
              //   to: `unresolved_local_import_${moduleSpecifier.replace(/[^a-zA-Z0-9]/g, "_")}`,
              //   fromKind: importEntity.kind,
              //   toKind: "SourceFile", // Assume it's a source file
              //   type: "IMPORTS",
              //   evidence: `Unresolved local import: ${moduleSpecifier}`,
              //   confidence: "low",
              //   metadata: {
              //     module: moduleSpecifier,
              //     importType: "local",
              //     unresolved: true,
              //     sourceFile: relativePath
              //   }
              // });
            }
          } else {
            // External import - create simple external module entity and IMPORTS relationship
            const externalModuleId = `external_${moduleSpecifier.replace(/[^a-zA-Z0-9]/g, "_")}`;

            // Create external module entity if not already added
            if (!entities.find(e => e.id === externalModuleId)) {
              const externalModuleEntity: GraphEntity = {
                id: externalModuleId,
                kind: "ExternalModule",
                name: moduleSpecifier,
                text: `External module: ${moduleSpecifier}`,
                filePath: "<external>",
                line: 0,
                column_num: 0,
                pos: 0,
                end: 0,
                flags: 0
              };
              entities.push(externalModuleEntity);
            }

            relationships.push({
              from: importEntity.id,
              to: externalModuleId,
              fromKind: importEntity.kind,
              toKind: "ExternalModule",
              type: "IMPORTS_EXTERNAL",
              evidence: `External import: ${moduleSpecifier}`,
              confidence: "medium",
              metadata: {
                module: moduleSpecifier,
                importType: "external"
              }
            });
          }
        }
      }
    }
  }

  // Log skipped relationships summary if debugging
  if (debug && skippedRelationships.size > 0) {
    console.log(line, "Skipped relationships due to schema violations:");
    for (const [key, count] of skippedRelationships) {
      console.log(line, `  ${key}: ${count}`);
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
        fromKind: projectEntity.kind,
        toKind: appEntity.kind,
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
        fromKind: projectEntity.kind,
        toKind: pkgEntity.kind,
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
            fromKind: appEntity.kind,
            toKind: sourceFileEntity.kind,
            type: "HAS_ENTRYPOINT",
            evidence: `Application entry point: ${relativePath}`,
            confidence: "high",
            metadata: {
              entryType:
                entryPointPath === resolve(projectRoot, appInfo.main || "")
                  ? "main"
                  : entryPointPath === resolve(projectRoot, appInfo.types || "")
                    ? "types"
                    : "bin"
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
      const dependencyEntities = entities.filter(e => e.kind === "Dependency");

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

      console.log(
        line,
        ` Created ${depRelationships.length} package dependency relationships`
      );
      console.log(
        line,
        ` Created ${usageRelationships.length} import usage relationships`
      );
    }
  }

  // Final pass: Update SourceFile relationshipCount efficiently
  // Create a map for fast entity ID to file path lookups
  const entityIdToFilePath = new Map<string, string>();
  for (const entity of entities) {
    if (entity.filePath && entity.filePath !== "<external>") {
      entityIdToFilePath.set(entity.id, entity.filePath);
    }
  }

  // Count relationships by file path
  const fileRelationshipCounts = new Map<string, number>();
  for (const rel of relationships) {
    const fromFilePath = entityIdToFilePath.get(rel.from);
    const toFilePath = entityIdToFilePath.get(rel.to);

    if (fromFilePath) {
      fileRelationshipCounts.set(
        fromFilePath,
        (fileRelationshipCounts.get(fromFilePath) || 0) + 1
      );
    }
    if (toFilePath && toFilePath !== fromFilePath) {
      fileRelationshipCounts.set(
        toFilePath,
        (fileRelationshipCounts.get(toFilePath) || 0) + 1
      );
    }
  }

  for (const [relativePath, sourceFileEntity] of fileEntities) {
    sourceFileEntity.relationshipCount =
      fileRelationshipCounts.get(relativePath) || 0;
  }

  return {
    entities,
    relationships
  };
}
