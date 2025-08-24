import { resolve } from "path";

export function codeEntityCustomizer(options: any = {}) {
  return (node, context) => {
    const { entityFilter, enableLinks = false } = options as any;

    // File-level node
    if (node.filePath) {
      const entityCount = node.entities.length;
      const entityTypes = [...new Set(node.entities.map(e => e.type))];
      const relationshipCount = 0; // TODO: implement relationships

      let metadata = `${entityCount} ${entityFilter || "entities"}`;
      if (entityTypes.length > 0) {
        metadata += ` (${entityTypes.join(", ")})`;
      }
      if (relationshipCount > 0) {
        metadata += ` • ${relationshipCount} relationships`;
      }

      const result: any = {
        name: node.filePath.replace(process.cwd() + "/", ""),
        metadata,
        children: node.entities
      };
      if (enableLinks) {
        result.link = `vscode://file${resolve(node.filePath)}`;
      }
      return result;
    }

    // Entity node
    const entity = node;
    const typeEmojis = {
      function: "🔧",
      class: "🏗️",
      interface: "📋",
      type: "🔤",
      import: "📦",
      export: "📤",
      variable: "📊"
    };

    const emoji = typeEmojis[entity.type] || "📄";
    let displayName = `${emoji} ${entity.name}`;

    // Add modifiers to display name
    if (entity.isAsync) displayName += " (async)";
    if (entity.isExported) displayName += " (exported)";
    if (entity.isAbstract) displayName += " (abstract)";
    if (entity.isDefault) displayName += " (default)";
    if (entity.isReExport) displayName += " (re-export)";

    // Add metadata based on entity type
    let metadata = [`line ${entity.line}`];

    if (entity.type === "import" && entity.module) {
      metadata.push(`from "${entity.module}"`);
    }

    if (entity.type === "export") {
      if (entity.module) {
        metadata.push(`from "${entity.module}"`);
      }
      if (entity.exportType) {
        metadata.push(`type: ${entity.exportType}`);
      }
    }

    const result: any = {
      name: displayName,
      metadata: metadata.join(" • "),
      content: entity.signature ? [entity.signature] : null
    };
    if (enableLinks) {
      result.link = `vscode://file${resolve(node.filePath || process.cwd())}:${entity.line}:1`;
    }
    return result;
  };
}
