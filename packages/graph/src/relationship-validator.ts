import type { GraphEntity, GraphRelationship } from "./types.js";

// Define allowed relationship schemas based on Kuzu schema
const ALLOWED_RELATIONSHIPS = {
  CALLS: [
    ["Function", "Function"],
    ["Method", "Function"],
    ["Method", "Method"],
    ["SourceFile", "Function"],
    ["SourceFile", "Method"],
    ["SourceFile", "ImportAlias"],
    ["Function", "ImportAlias"],
    ["Method", "ImportAlias"]
  ],
  REFERENCES: [
    ["Function", "Variable"],
    ["Method", "Variable"],
    ["Method", "Property"],
    ["Class", "Interface"],
    ["SourceFile", "Variable"],
    ["SourceFile", "Property"],
    ["SourceFile", "ImportAlias"],
    ["Function", "ImportAlias"],
    ["Method", "ImportAlias"]
  ],
  CONTAINS: [
    ["SourceFile", "Function"],
    ["SourceFile", "Class"],
    ["SourceFile", "Interface"],
    ["SourceFile", "Variable"],
    ["SourceFile", "Enum"],
    ["SourceFile", "TypeAlias"],
    ["SourceFile", "ImportAlias"],
    ["Class", "Method"],
    ["Class", "Property"],
    ["Function", "Variable"],
    ["Method", "Variable"]
  ],
  EXPORTS: [
    ["SourceFile", "Function"],
    ["SourceFile", "Class"],
    ["SourceFile", "Interface"],
    ["SourceFile", "Variable"],
    ["SourceFile", "Enum"],
    ["SourceFile", "TypeAlias"],
    ["Function", "ExportAlias"],
    ["Class", "ExportAlias"],
    ["Interface", "ExportAlias"],
    ["Variable", "ExportAlias"],
    ["Enum", "ExportAlias"],
    ["TypeAlias", "ExportAlias"]
  ],
  IMPORTS: [
    ["ImportAlias", "Function"],
    ["ImportAlias", "Class"],
    ["ImportAlias", "Interface"],
    ["ImportAlias", "Variable"],
    ["ImportAlias", "TypeAlias"],
    ["ImportAlias", "Enum"],
    ["ImportAlias", "ExternalModule"],
    ["SourceFile", "Function"],
    ["SourceFile", "Class"],
    ["SourceFile", "Interface"],
    ["SourceFile", "Variable"],
    ["SourceFile", "TypeAlias"],
    ["SourceFile", "Enum"]
  ],
  RESOLVES_TO: [
    ["ImportAlias", "Function"],
    ["ImportAlias", "Class"],
    ["ImportAlias", "Interface"],
    ["ImportAlias", "Variable"],
    ["ImportAlias", "TypeAlias"],
    ["ImportAlias", "Enum"]
  ],
  INSTANCE_OF: [
    ["Variable", "Class"],
    ["Property", "Class"]
  ],
  EXTENDS: [
    ["Class", "Class"],
    ["Interface", "Interface"]
  ],
  IMPLEMENTS: [["Class", "Interface"]],
  TYPE_OF: [
    ["Variable", "TypeAlias"],
    ["Variable", "Interface"],
    ["Property", "TypeAlias"],
    ["Property", "Interface"]
  ],
  IMPORTS_EXTERNAL: [["ImportAlias", "ExternalModule"]],
  HAS_APPLICATION: [["Project", "Application"]],
  HAS_PACKAGE: [["Project", "Package"]],
  HAS_ENTRYPOINT: [["Application", "SourceFile"]],
  DEPENDS_ON: [["Package", "Dependency"]],
  USES_DEPENDENCY: [["ImportAlias", "Dependency"]],
  IMPORTS_FROM: [["ImportAlias", "Dependency"]]
};

/**
 * Validate if a relationship is allowed based on the Kuzu schema
 */
export function isRelationshipAllowed(
  relationshipType: string,
  fromKind: string,
  toKind: string
): boolean {
  const allowedPairs =
    ALLOWED_RELATIONSHIPS[relationshipType as keyof typeof ALLOWED_RELATIONSHIPS];
  if (!allowedPairs) {
    // If relationship type is not defined in our schema, allow it (better to be permissive)
    return true;
  }

  return allowedPairs.some(([from, to]) => from === fromKind && to === toKind);
}

/**
 * Filter relationships to only include those allowed by the Kuzu schema
 */
export function filterValidRelationships(
  relationships: GraphRelationship[],
  entities: GraphEntity[],
  debug: boolean = false
): GraphRelationship[] {
  const entityKindMap = new Map(entities.map(entity => [entity.id, entity.kind]));

  const validRelationships: GraphRelationship[] = [];
  let skippedCount = 0;

  for (const relationship of relationships) {
    const fromKind = entityKindMap.get(relationship.from) || relationship.fromKind;
    const toKind = entityKindMap.get(relationship.to) || relationship.toKind;

    const isValid = isRelationshipAllowed(relationship.type, fromKind, toKind);

    if (isValid) {
      validRelationships.push(relationship);
    } else {
      skippedCount++;
      if (debug) {
        console.warn(
          `Skipping ${relationship.type} relationship from ${fromKind} to ${toKind} - not allowed in schema`
        );
      }
    }
  }

  if (debug && skippedCount > 0) {
    console.log(`Skipped ${skippedCount} relationships that violated the schema`);
  }

  return validRelationships;
}
