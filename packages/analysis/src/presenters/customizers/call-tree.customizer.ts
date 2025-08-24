import { resolve } from "path";

// Reverse call tree customizer for incoming calls
export function reverseCallTreeCustomizer() {
  return (node: any) => {
    if (node.filePath) {
      // File-level node
      return {
        name: node.filePath.replace(process.cwd() + "/", ""),
        children: node.functions
      };
    }

    if (node.callers) {
      // Function node with incoming calls
      const [, funcName] = node.id.split(":");
      return {
        name: `🔧 ${funcName}`,
        link: node.file !== "external" ? `vscode://file${resolve(node.file)}` : null,
        metadata: `called by ${node.callers.length} functions`,
        children: node.callers
      };
    }

    // Caller node
    return {
      name: `← ${node.name}`,
      link: node.file !== "external" ? `vscode://file${resolve(node.file)}` : null,
      metadata: node.file.replace(process.cwd() + "/", "")
    };
  };
}

// Call tree customizer for outgoing calls
export function callTreeCustomizer() {
  return (node: any) => {
    if (node.filePath) {
      // File-level node
      return {
        name: node.filePath.replace(process.cwd() + "/", ""),
        children: node.functions
      };
    }

    if (node.calls) {
      // Function node with outgoing calls
      const [, funcName] = node.id.split(":");
      return {
        name: `🔧 ${funcName}`,
        link: node.file !== "external" ? `vscode://file${resolve(node.file)}` : null,
        metadata: `calls ${node.calls.length} functions`,
        children: node.calls
      };
    }

    // Call target node
    return {
      name: `→ ${node.name}`,
      link: node.file !== "external" ? `vscode://file${resolve(node.file)}` : null,
      metadata: node.file.replace(process.cwd() + "/", "")
    };
  };
}
