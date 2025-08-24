import { resolve } from "path";

export function topologicalTreeCustomizer() {
  return (node, context) => {
    // Handle group nodes
    if (node.type === "group") {
      return {
        name: node.name,
        metadata: `(${node.entities.length} ${node.entities.length === 1 ? "entity" : "entities"})`,
        children: node.entities
      };
    }

    // Handle entity nodes
    const entity = node;
    const entityEmojis = {
      function: "🔧",
      class: "🏗️",
      interface: "📋",
      type: "🔤",
      import: "📦",
      export: "📤",
      variable: "📊"
    };

    const emoji = entityEmojis[entity.type] || "📄";
    let displayName = `${emoji} ${entity.name}`;

    // Add modifiers to display name
    if (entity.isAsync) displayName += " (async)";
    if (entity.isExported) displayName += " (exported)";
    if (entity.isAbstract) displayName += " (abstract)";
    if (entity.isDefault) displayName += " (default)";
    if (entity.isReExport) displayName += " (re-export)";

    // Build metadata
    const fileShort = entity.filePath.replace(process.cwd() + "/", "");
    const metadata = [`${fileShort}:${entity.line}`];

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

    return {
      name: displayName,
      link: `vscode://file${resolve(entity.filePath)}:${entity.line}:1`,
      metadata: metadata.join(" • "),
      content: entity.signature ? [entity.signature] : null
    };
  };
}
