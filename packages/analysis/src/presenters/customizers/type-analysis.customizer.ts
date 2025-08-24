import { resolve } from "path";

// Type analysis customizer
export function typeAnalysisCustomizer(options: any = {}) {
  return (node: any) => {
    const { enableLinks = false } = options;
    if (node.filePath) {
      // File-level node
      const { typeGroups } = node;
      const totalTypes = Object.values(typeGroups).reduce(
        (sum, arr: any) => sum + arr.length,
        0
      );

      const children = [];
      if (typeGroups.interfaces.length > 0) {
        children.push({
          type: "group",
          kind: "interfaces",
          items: typeGroups.interfaces
        });
      }
      if (typeGroups.classes.length > 0) {
        children.push({
          type: "group",
          kind: "classes",
          items: typeGroups.classes
        });
      }
      if (typeGroups.types.length > 0) {
        children.push({
          type: "group",
          kind: "types",
          items: typeGroups.types
        });
      }
      if (typeGroups.enums.length > 0) {
        children.push({
          type: "group",
          kind: "enums",
          items: typeGroups.enums
        });
      }

      return {
        name: node.filePath.replace(process.cwd() + "/", ""),
        link: enableLinks ? `vscode://file${resolve(node.filePath)}` : undefined,
        metadata: `${totalTypes} types`,
        children
      };
    }

    if (node.type === "group") {
      const emojis: {[key: string]: string} = {
        interfaces: "📋",
        classes: "🏗️",
        types: "🔤",
        enums: "🔢"
      };

      return {
        name: `${emojis[node.kind]} ${node.kind.toUpperCase()} (${node.items.length})`,
        children: node.items
      };
    }

    // Individual type node
    const emojis: {[key: string]: string} = {
      interface: "📋",
      class: "🏗️",
      type: "🔤",
      enum: "🔢"
    };

    let metadata = [`line ${node.line}`];

    if (node.typeParameters?.length > 0) {
      metadata.push(`generic<${node.typeParameters.join(", ")}>`);
    }

    if (node.extends?.length > 0) {
      metadata.push(`extends ${node.extends.join(", ")}`);
    }

    if (node.implements?.length > 0) {
      metadata.push(`implements ${node.implements.join(", ")}`);
    }

    if (node.isExported) {
      metadata.push("exported");
    }

    return {
      name: `${emojis[node.kind]} ${node.name}`,
      link: enableLinks
        ? `vscode://file${resolve(node.filePath)}:${node.line}:1`
        : undefined,
      metadata: metadata.join(" • ")
    };
  };
}
