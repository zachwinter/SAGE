import { getContextLines } from "./parser-utils.js";
import type { AnalysisOptions, FileAnalysisResult } from "../../types.js";

export function analyzeRustFile(
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
    const funcMatch = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
    if (funcMatch) {
      entities.push({
        type: "function",
        name: funcMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Struct declarations
    const structMatch = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
    if (structMatch) {
      entities.push({
        type: "struct",
        name: structMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Enum declarations
    const enumMatch = trimmed.match(/^(?:pub\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      entities.push({
        type: "enum",
        name: enumMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Trait declarations
    const traitMatch = trimmed.match(/^(?:pub\s+)?trait\s+(\w+)/);
    if (traitMatch) {
      entities.push({
        type: "trait",
        name: traitMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Implementation blocks
    const implMatch = trimmed.match(
      /^impl(?:\s+<[^>]*>)?\s+(?:(\w+)\s+for\s+)?(\w+)/
    );
    if (implMatch) {
      const trait = implMatch[1];
      const type = implMatch[2];
      const name = trait ? `${trait} for ${type}` : type;
      entities.push({
        type: "implementation",
        name: name,
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Module declarations
    const modMatch = trimmed.match(/^(?:pub\s+)?mod\s+(\w+)/);
    if (modMatch) {
      entities.push({
        type: "module",
        name: modMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Use statements (imports)
    const useMatch = trimmed.match(/^use\s+(.+);$/);
    if (useMatch) {
      const imported = useMatch[1].replace(/\s+as\s+\w+/, "").trim();
      entities.push({
        type: "import",
        name: imported,
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Constants
    const constMatch = trimmed.match(/^(?:pub\s+)?const\s+(\w+)/);
    if (constMatch) {
      entities.push({
        type: "constant",
        name: constMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Static variables
    const staticMatch = trimmed.match(/^(?:pub\s+)?static\s+(?:mut\s+)?(\w+)/);
    if (staticMatch) {
      entities.push({
        type: "static",
        name: staticMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
      });
    }

    // Type aliases
    const typeMatch = trimmed.match(/^(?:pub\s+)?type\s+(\w+)/);
    if (typeMatch) {
      entities.push({
        type: "type-alias",
        name: typeMatch[1],
        line: lineNumber,
        signature: trimmed,
        contextLines: getContextLines(lines, lineNumber, contextSize),
        language: "rust"
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
    totalLines: lines.length,
    language: "rust"
  };
}
