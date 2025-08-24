import { resolve } from "path";

// Full call tree customizer
export function fullCallTreeCustomizer(options: any = {}) {
  return (node: any) => {
    const { enableLinks = false } = options;
    if (node.filePath) {
      // File-level node
      const result: any = {
        name: node.filePath.replace(process.cwd() + "/", ""),
        children: node.functions
      };
      if (enableLinks) {
        result.link = `vscode://file${resolve(node.filePath)}`;
      }
      return result;
    }

    if (node.calls !== undefined && node.callers !== undefined) {
      // Function node
      const children = [];

      if (node.calls.length > 0) {
        children.push({
          type: "calls-group",
          name: "Calls",
          calls: node.calls
        });
      }

      if (node.callers.length > 0) {
        children.push({
          type: "callers-group",
          name: "Called by",
          callers: node.callers
        });
      }

      return {
        name: `🔧 ${node.name}`,
        metadata: `${node.calls.length} calls, ${node.callers.length} callers`,
        children
      };
    }

    if (node.type === "calls-group") {
      return {
        name: `→ ${node.name} (${node.calls.length})`,
        children: node.calls
      };
    }

    if (node.type === "callers-group") {
      return {
        name: `← ${node.name} (${node.callers.length})`,
        children: node.callers
      };
    }

    // Individual call/caller node
    return {
      name: node.name,
      link: node.file !== "external" ? `vscode://file${resolve(node.file)}` : null,
      metadata: node.file.replace(process.cwd() + "/", "")
    };
  };
}
