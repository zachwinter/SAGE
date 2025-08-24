import type {
  FileAnalysisResult,
  TopologicalSortResult,
  CodeEntity
} from "../../types.js";

export function performTopologicalSort(
  analysisResults: FileAnalysisResult[]
): TopologicalSortResult {
  // Build dependency graph
  const allEntities = [];
  const entityMap = new Map(); // entity id -> entity
  const dependencyGraph = new Map(); // entity id -> Set of dependencies
  const reverseDependencyGraph = new Map(); // entity id -> Set of dependents

  // Collect all entities and build maps
  for (const fileResult of analysisResults) {
    for (const entity of fileResult.entities) {
      const entityId = `${fileResult.filePath}:${entity.name}`;
      entity.id = entityId;
      entity.filePath = fileResult.filePath;

      allEntities.push(entity);
      entityMap.set(entityId, entity);
      dependencyGraph.set(entityId, new Set());
      reverseDependencyGraph.set(entityId, new Set());
    }
  }

  // Build dependency relationships
  for (const fileResult of analysisResults) {
    for (const entity of fileResult.entities) {
      const entityId = entity.id;
      const dependencies = extractEntityDependencies(
        entity,
        fileResult,
        allEntities
      );

      for (const depId of dependencies) {
        if (entityMap.has(depId)) {
          dependencyGraph.get(entityId).add(depId);
          reverseDependencyGraph.get(depId).add(entityId);
        }
      }
    }
  }

  // Perform topological sort (Kahn's algorithm)
  const sorted = [];
  const inDegree = new Map();

  // Calculate in-degrees
  for (const [entityId] of entityMap) {
    inDegree.set(entityId, dependencyGraph.get(entityId).size);
  }

  // Find entities with no dependencies
  const queue = [];
  for (const [entityId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(entityId);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const entityId = queue.shift();
    const entity = entityMap.get(entityId);
    sorted.push(entity);

    // Remove this entity from dependents' dependency counts
    for (const dependentId of reverseDependencyGraph.get(entityId)) {
      inDegree.set(dependentId, inDegree.get(dependentId) - 1);
      if (inDegree.get(dependentId) === 0) {
        queue.push(dependentId);
      }
    }
  }

  // Handle cycles (entities not yet processed)
  const remaining = [];
  for (const [entityId] of entityMap) {
    if (!sorted.find(e => e.id === entityId)) {
      remaining.push(entityMap.get(entityId));
    }
  }

  return { sorted, cycles: remaining };
}

export function extractEntityDependencies(
  entity: CodeEntity,
  fileResult: FileAnalysisResult,
  allEntities: CodeEntity[]
): Set<string> {
  const dependencies = new Set<string>();

  // For imports, add dependencies on the imported entities
  if (entity.type === "import") {
    // Try to find the imported entities in other files
    const importedNames = entity.name.split(", ").map(name => name.trim());
    for (const name of importedNames) {
      // Look for entities with this name in other files
      for (const otherEntity of allEntities) {
        if (
          otherEntity.name === name &&
          otherEntity.filePath !== fileResult.filePath &&
          otherEntity.id
        ) {
          dependencies.add(otherEntity.id);
        }
      }
    }
  }

  // For functions/classes, analyze their content for calls/references
  if (entity.signature) {
    // Simple heuristic: look for function calls in the signature
    const words = entity.signature.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    for (const word of words) {
      // Skip common keywords and built-ins
      if (
        [
          "function",
          "const",
          "let",
          "var",
          "class",
          "interface",
          "type",
          "import",
          "export",
          "from",
          "as",
          "return",
          "if",
          "else",
          "for",
          "while",
          "try",
          "catch"
        ].includes(word)
      ) {
        continue;
      }

      // Look for entities with this name
      for (const otherEntity of allEntities) {
        if (
          otherEntity.name === word &&
          otherEntity.id !== entity.id &&
          otherEntity.id
        ) {
          dependencies.add(otherEntity.id);
        }
      }
    }
  }

  return dependencies;
}
