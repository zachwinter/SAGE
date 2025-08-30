/**
 * Detects programming language from file path extension
 */
export function getLanguageFromPath(filePath: string): string | undefined {
  if (!filePath) return undefined;

  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return "typescript";
    case "py":
    case "pyw":
    case "pyi":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "java":
      return "java";
    case "kt":
    case "kts":
      return "kotlin";
    case "cpp":
    case "cc":
    case "cxx":
    case "c++":
      return "cpp";
    case "c":
    case "h":
      return "c";
    case "cs":
      return "csharp";
    case "php":
      return "php";
    case "rb":
      return "ruby";
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "toml":
      return "toml";
    case "xml":
      return "xml";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "scss":
    case "sass":
      return "scss";
    case "less":
      return "less";
    case "md":
    case "markdown":
      return "markdown";
    case "sql":
      return "sql";
    case "dockerfile":
      return "dockerfile";
    case "vim":
      return "vim";
    case "lua":
      return "lua";
    case "r":
      return "r";
    case "swift":
      return "swift";
    case "dart":
      return "dart";
    case "scala":
      return "scala";
    default:
      return undefined;
  }
}

/**
 * Detects language from file path, with fallback to simple extension
 */
export function getLanguageOrExtension(filePath: string): string | undefined {
  const language = getLanguageFromPath(filePath);
  if (language) return language;

  // Fallback to just the extension
  return filePath.split(".").pop()?.toLowerCase();
}
