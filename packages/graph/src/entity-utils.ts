import { createHash } from "crypto";
import type { GraphEntity } from "./types.js";

/**
 * Convert generic entity type to first-class entity kind
 */
export function getEntityKind(entityType: string): string {
  switch (entityType) {
    case "function":
      return "Function";
    case "class":
      return "Class";
    case "variable":
      return "Variable";
    case "interface":
      return "Interface";
    case "enum":
      return "Enum";
    case "type":
      return "TypeAlias";
    case "import":
      return "ImportAlias";
    case "export":
      return "ExportAlias";
    default:
      return entityType;
  }
}

/**
 * Create a unique entity ID
 */
export function createEntityId(entity: any, filePath: string): string {
  const input = `${filePath}:${entity.type}:${entity.name}:${entity.line}`;
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

/**
 * Create a unique SourceFile ID
 * SourceFile uses path as PRIMARY KEY in Rust schema, so return path directly
 */
export function createSourceFileId(filePath: string): string {
  return filePath;
}

/**
 * Convert generic entity to first-class entity with proper kind and metadata
 */
export function createFirstClassEntity(entity: any, filePath: string): GraphEntity {
  const baseId = entity.id || createEntityId(entity, filePath);

  // Determine context for Method vs Function, Property vs Variable
  const parentScopeType = entity.parentScopeId
    ? getParentScopeType(entity.parentScopeId)
    : null;

  switch (entity.type) {
    case "function":
      // Function vs Method: Methods belong to classes
      const isMethod = parentScopeType === "class";
      return {
        id: baseId,
        kind: isMethod ? "Method" : "Function",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        // Function/Method specific metadata
        isAsync: entity.isAsync || false,
        isExported: entity.isExported || false,
        ...(isMethod && {
          isStatic: false, // TODO: Extract from signature
          visibility: "public", // TODO: Extract from signature
          className: getParentClassName(entity.parentScopeId)
        }),
        returnType: extractReturnType(entity.signature),
        parameters: extractParameters(entity.signature),
        signature: entity.signature
      };

    case "class":
      return {
        id: baseId,
        kind: "Class",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        isAbstract: entity.isAbstract || false,
        isExported: entity.isExported || false,
        superClass: extractSuperClass(entity.signature),
        interfaces: extractInterfaces(entity.signature),
        signature: entity.signature
      };

    case "variable":
      // Property vs Variable: Properties belong to classes
      const isProperty = parentScopeType === "class";
      return {
        id: baseId,
        kind: isProperty ? "Property" : "Variable",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        type: extractVariableType(entity.signature),
        isConst: entity.signature.includes("const"),
        isExported: entity.isExported || false,
        ...(isProperty && {
          isStatic: false, // TODO: Extract from signature
          visibility: "public", // TODO: Extract from signature
          isReadonly: entity.signature.includes("readonly"),
          isOptional: entity.signature.includes("?"),
          className: getParentClassName(entity.parentScopeId)
        }),
        ...(!isProperty && {
          scope: parentScopeType || "module"
        }),
        defaultValue: extractDefaultValue(entity.signature),
        signature: entity.signature
      };

    case "interface":
      return {
        id: baseId,
        kind: "Interface",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        isExported: entity.isExported || false,
        extends: extractInterfaceExtends(entity.signature),
        properties: extractInterfaceProperties(entity.signature),
        signature: entity.signature
      };

    case "enum":
      return {
        id: baseId,
        kind: "Enum",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        isConst: entity.signature.includes("const enum"),
        isExported: entity.isExported || false,
        members: extractEnumMembers(entity.signature),
        signature: entity.signature
      };

    case "type":
      return {
        id: baseId,
        kind: "TypeAlias",
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId,
        isExported: entity.isExported || false,
        definition: extractTypeDefinition(entity.signature),
        typeParameters: extractTypeParameters(entity.signature),
        signature: entity.signature
      };

    case "import":
      const importPath = entity.module || extractImportPath(entity.signature);
      // Create JSON metadata for Rust ingester
      const importMetadata = {
        localName: entity.name,
        originalName: extractOriginalImportName(entity.name, entity.signature),
        importPath: importPath,
        signature: entity.signature
      };
      return {
        id: baseId,
        kind: "ImportAlias",
        name: entity.name,
        text: JSON.stringify(importMetadata),
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId
      };

    case "export":
      // Create JSON metadata for Rust ingester
      const exportMetadata = {
        localName: entity.name,
        originalName: extractOriginalExportName(entity.name, entity.signature),
        exportType: entity.isDefault ? "default" : (entity.exportType || "named"),
        signature: entity.signature
      };
      return {
        id: baseId,
        kind: "ExportAlias",
        name: entity.name,
        text: JSON.stringify(exportMetadata),
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId
      };

    default:
      // Filter out Rust types - they'll be handled by Rust analysis later
      const rustTypes = [
        "struct",
        "implementation",
        "module",
        "constant",
        "static",
        "trait",
        "type-alias"
      ];
      if (!rustTypes.includes(entity.type)) {
        console.warn(
          `Unsupported entity type for first-class conversion: ${entity.type}`
        );
      }

      // Fallback: keep generic entity structure for unsupported types
      return {
        id: baseId,
        kind: entity.type,
        name: entity.name,
        text: entity.signature,
        filePath,
        line: entity.line,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        parentScopeId: entity.parentScopeId
      };
  }
}

// Helper functions for extracting metadata from signatures
function getParentScopeType(parentScopeId?: string): string | null {
  // TODO: Look up parent scope type from entityCache
  // For now, return null - this would need entity resolution
  return null;
}

function getParentClassName(parentScopeId?: string): string {
  // TODO: Extract class name from parentScopeId
  return "";
}

function extractReturnType(signature: string): string {
  const match = signature.match(/:\s*([^{=]+?)(?:\s*[{=]|$)/);
  return match ? match[1].trim() : "any";
}

function extractParameters(signature: string): string[] {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return [];

  const params = match[1]
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);
  return params;
}

function extractSuperClass(signature: string): string {
  const match = signature.match(/extends\s+(\w+)/);
  return match ? match[1] : "";
}

function extractInterfaces(signature: string): string[] {
  const match = signature.match(/implements\s+([^{]+)/);
  if (!match) return [];

  return match[1].split(",").map(i => i.trim());
}

function extractVariableType(signature: string): string {
  const match = signature.match(/:\s*([^=]+?)(?:\s*=|$)/);
  return match ? match[1].trim() : "any";
}

function extractDefaultValue(signature: string): string {
  const match = signature.match(/=\s*(.+)$/);
  return match ? match[1].trim() : "";
}

function extractInterfaceExtends(signature: string): string[] {
  const match = signature.match(/extends\s+([^{]+)/);
  if (!match) return [];

  return match[1].split(",").map(i => i.trim());
}

function extractInterfaceProperties(signature: string): string[] {
  // Simple extraction - would need full AST for accurate parsing
  return [];
}

function extractEnumMembers(signature: string): string[] {
  const match = signature.match(/{\s*([^}]+)\s*}/);
  if (!match) return [];

  return match[1]
    .split(",")
    .map(m => m.trim())
    .filter(Boolean);
}

function extractTypeDefinition(signature: string): string {
  const match = signature.match(/=\s*(.+)$/);
  return match ? match[1].trim() : "";
}

function extractTypeParameters(signature: string): string[] {
  const match = signature.match(/<([^>]+)>/);
  if (!match) return [];

  return match[1].split(",").map(p => p.trim());
}

function extractOriginalImportName(localName: string, signature: string): string {
  // Handle "import { originalName as localName }" pattern
  const aliasMatch = signature.match(/{\s*(\w+)\s+as\s+\w+\s*}/);
  if (aliasMatch) return aliasMatch[1];

  // Default case: local and original are the same
  return localName;
}

function extractImportPath(signature: string): string {
  const match = signature.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : "";
}

function extractOriginalExportName(localName: string, signature: string): string {
  // Handle "export { originalName as localName }" pattern
  const aliasMatch = signature.match(/{\s*(\w+)\s+as\s+\w+\s*}/);
  if (aliasMatch) return aliasMatch[1];

  // Handle "default (functionName)" format
  if (localName.startsWith("default (") && localName.endsWith(")")) {
    return localName.slice(9, -1);
  }

  // Default case: local and original are the same
  return localName;
}
