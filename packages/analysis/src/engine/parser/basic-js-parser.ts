import { getContextLines } from "./parser-utils.js";
import type { AnalysisOptions, FileAnalysisResult } from "../../types.js";

export function analyzeFileBasic(
  filePath: string,
  content: string,
  options: AnalysisOptions = {}
): FileAnalysisResult {
  const entities: any[] = [];
  const lines = content.split("\n");
  const contextSize = parseInt(String(options.context || 0), 10);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    // Function declarations
    const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      entities.push({
        type: "function",
        name: funcMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Arrow functions
    const arrowMatch = trimmed.match(
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/
    );
    if (arrowMatch) {
      entities.push({
        type: "function",
        name: arrowMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Class declarations
    const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      entities.push({
        type: "class",
        name: classMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Interface declarations
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      entities.push({
        type: "interface",
        name: interfaceMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Type declarations
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      entities.push({
        type: "type",
        name: typeMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Import statements
    const importMatch = trimmed.match(/^import\s+(.+)\s+from\s+['"`](.+)['"`]/);
    if (importMatch) {
      entities.push({
        type: "import",
        name: importMatch[1].replace(/[{}]/g, "").trim(),
        module: importMatch[2],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize)
      });
    }

    // Export statements
    // export { name1, name2 } from 'module'
    const namedExportMatch = trimmed.match(
      /^export\s+\{([^}]+)\}(?:\s+from\s+['"`](.+)['"`])?/
    );
    if (namedExportMatch) {
      const names = namedExportMatch[1].replace(/\s+as\s+/g, " as ").trim();
      const module = namedExportMatch[2];
      entities.push({
        type: "export",
        name: names,
        module: module,
        exportType: "named",
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        isReExport: !!module
      });
    }

    // export * from 'module'
    const allExportMatch = trimmed.match(
      /^export\s+\*(?:\s+as\s+(\w+))?\s+from\s+['"`](.+)['"`]/
    );
    if (allExportMatch) {
      const asName = allExportMatch[1];
      const module = allExportMatch[2];
      entities.push({
        type: "export",
        name: asName ? `* as ${asName}` : "*",
        module: module,
        exportType: asName ? "namespace" : "all",
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        isReExport: true
      });
    }

    // export default
    const defaultExportMatch = trimmed.match(/^export\s+default\s+(.+)/);
    if (defaultExportMatch) {
      const expression = defaultExportMatch[1];
      let name = "default";

      // Try to extract identifier if it's a simple reference
      const identifierMatch = expression.match(/^(\w+)(?:\s*[;,])?$/);
      if (identifierMatch) {
        name = `default (${identifierMatch[1]})`;
      }

      entities.push({
        type: "export",
        name: name,
        exportType: "default",
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        isDefault: true,
        isReExport: false
      });
    }
  });

  return {
    filePath,
    entities,
    callExpressions: [],
    typeInfo: {
      typeAliases: [],
      interfaces: [],
      classes: [],
      enums: [],
      typeReferences: []
    },
    totalLines: lines.length
  };
}
