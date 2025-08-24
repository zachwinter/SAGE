import type { FileAnalysisResult, TypeAnalysisResult } from "../../types.js";

// Perform type analysis
export function performTypeAnalysis(
  analysisResults: FileAnalysisResult[]
): TypeAnalysisResult {
  const allTypes = new Map();
  const typeRelationships = new Map();

  for (const fileResult of analysisResults) {
    const { typeInfo } = fileResult;

    // Process type aliases
    for (const typeAlias of typeInfo.typeAliases || []) {
      const typeId = `${fileResult.filePath}:${typeAlias.name}`;
      allTypes.set(typeId, {
        ...typeAlias,
        kind: "type",
        filePath: fileResult.filePath
      });
    }

    // Process interfaces
    for (const iface of typeInfo.interfaces || []) {
      const typeId = `${fileResult.filePath}:${iface.name}`;
      allTypes.set(typeId, {
        ...iface,
        kind: "interface",
        filePath: fileResult.filePath
      });

      // Add inheritance relationships
      for (const parent of iface.extends || []) {
        if (!typeRelationships.has(typeId)) {
          typeRelationships.set(typeId, { extends: [], implementedBy: [] });
        }
        typeRelationships.get(typeId).extends.push(parent);
      }
    }

    // Process classes
    for (const cls of typeInfo.classes || []) {
      const typeId = `${fileResult.filePath}:${cls.name}`;
      allTypes.set(typeId, {
        ...cls,
        kind: "class",
        filePath: fileResult.filePath
      });

      // Add inheritance and implementation relationships
      for (const parent of cls.extends || []) {
        if (!typeRelationships.has(typeId)) {
          typeRelationships.set(typeId, { extends: [], implements: [] });
        }
        typeRelationships.get(typeId).extends.push(parent);
      }

      for (const iface of cls.implements || []) {
        if (!typeRelationships.has(typeId)) {
          typeRelationships.set(typeId, { extends: [], implements: [] });
        }
        typeRelationships.get(typeId).implements.push(iface);
      }
    }

    // Process enums
    for (const enumDef of typeInfo.enums || []) {
      const typeId = `${fileResult.filePath}:${enumDef.name}`;
      allTypes.set(typeId, {
        ...enumDef,
        kind: "enum",
        filePath: fileResult.filePath
      });
    }
  }

  return {
    allTypes,
    typeRelationships,
    analysisResults
  };
}
