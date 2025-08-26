import Parser, { Tree, SyntaxNode } from "tree-sitter";
import TypescriptLanguage from "tree-sitter-typescript/typescript";
import JavascriptLanguage from "tree-sitter-javascript";
import RustLanguage from "tree-sitter-rust";
import type { 
  CodeEntity, 
  CallExpression, 
  TypeInformation,
  AnalysisOptions 
} from "../../types.js";
import { getContextLines } from "./parser-utils.js";

/**
 * Unified tree-sitter wrapper that replaces both TypeScript AST parsing and regex-based Rust parsing
 * This provides consistent, fast parsing across all supported languages
 */
export class TreeSitterWrapper {
  private parsers: Map<string, Parser> = new Map();

  constructor() {
    // Initialize parsers for each language
    this.initializeParser("typescript", TypescriptLanguage);
    this.initializeParser("javascript", JavascriptLanguage);
    this.initializeParser("rust", RustLanguage);
  }

  private initializeParser(language: string, languageGrammar: any): void {
    const parser = new Parser();
    parser.setLanguage(languageGrammar);
    this.parsers.set(language, parser);
  }

  /**
   * Parse a file and extract entities using tree-sitter
   * This replaces both TypeScript AST parsing and Rust regex parsing
   */
  public parseFile(
    filePath: string,
    content: string,
    options: AnalysisOptions = {}
  ): { 
    entities: CodeEntity[], 
    callExpressions: CallExpression[],
    typeInfo: TypeInformation,
    tree: Tree
  } {
    const language = this.detectLanguage(filePath);
    const parser = this.parsers.get(language);
    
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    const tree = parser.parse(content);
    const lines = content.split("\n");

    return {
      entities: this.extractEntities(tree.rootNode, filePath, lines, language, options),
      callExpressions: this.extractCallExpressions(tree.rootNode, lines),
      typeInfo: this.extractTypeInformation(tree.rootNode),
      tree
    };
  }

  /**
   * Detect the language based on file extension
   */
  private detectLanguage(filePath: string): string {
    if (filePath.endsWith(".rs")) return "rust";
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
    if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) return "javascript";
    
    // Default to typescript for unknown extensions
    return "typescript";
  }

  /**
   * Extract code entities from tree-sitter syntax tree
   * This replaces both TypeScript and Rust entity extraction
   */
  private extractEntities(
    rootNode: SyntaxNode, 
    filePath: string, 
    lines: string[], 
    language: string,
    options: AnalysisOptions
  ): CodeEntity[] {
    const entities: CodeEntity[] = [];
    const contextSize = parseInt(String(options.context || 0), 10);

    const extractFromNode = (node: SyntaxNode) => {
      const { row: line } = node.startPosition;
      const lineNumber = line + 1;

      switch (node.type) {
        // TypeScript/JavaScript entities
        case "function_declaration":
        case "function_expression":
        case "arrow_function":
        case "method_definition":
          this.extractFunction(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "class_declaration":
          this.extractClass(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "interface_declaration":
          this.extractInterface(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "type_alias_declaration":
          this.extractTypeAlias(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "import_statement":
        case "import_declaration":
          this.extractImport(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "export_statement":
        case "export_declaration":
          this.extractExport(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;
        
        case "variable_declaration":
        case "lexical_declaration":
          this.extractVariable(node, entities, filePath, lines, lineNumber, contextSize, language);
          break;

        // Rust entities
        case "function_item":
          this.extractRustFunction(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "struct_item":
          this.extractRustStruct(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "enum_item":
          this.extractRustEnum(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "trait_item":
          this.extractRustTrait(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "impl_item":
          this.extractRustImpl(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "mod_item":
          this.extractRustModule(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "use_declaration":
          this.extractRustUse(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "const_item":
          this.extractRustConst(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "static_item":
          this.extractRustStatic(node, entities, filePath, lines, lineNumber, contextSize);
          break;
        
        case "type_item":
          this.extractRustTypeAlias(node, entities, filePath, lines, lineNumber, contextSize);
          break;
      }

      // Recursively process child nodes
      for (let i = 0; i < node.childCount; i++) {
        extractFromNode(node.child(i)!);
      }
    };

    extractFromNode(rootNode);
    return entities;
  }

  // TypeScript/JavaScript entity extractors
  private extractFunction(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";
    const isAsync = node.text.includes("async");
    const isExported = this.hasExportModifier(node);

    entities.push({
      type: "function",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      isAsync,
      isExported
    } as any);
  }

  private extractClass(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";
    const isAbstract = node.text.includes("abstract");
    const isExported = this.hasExportModifier(node);

    entities.push({
      type: "class",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      isAbstract,
      isExported
    } as any);
  }

  private extractInterface(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";
    const isExported = this.hasExportModifier(node);

    entities.push({
      type: "interface",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      isExported
    } as any);
  }

  private extractTypeAlias(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";
    const isExported = this.hasExportModifier(node);

    entities.push({
      type: "type",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      isExported
    } as any);
  }

  private extractImport(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    const sourceNode = node.childForFieldName("source");
    const module = sourceNode?.text?.replace(/['"]/g, '') || "unknown";
    
    // Extract import names
    const clauseNode = node.childForFieldName("import");
    let importNames: string[] = [];
    
    if (clauseNode) {
      this.extractImportNames(clauseNode, importNames);
    }

    entities.push({
      type: "import",
      name: importNames.join(", ") || "side-effect",
      module,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath
    } as any);
  }

  private extractExport(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    // Simplified export extraction - can be enhanced
    entities.push({
      type: "export",
      name: "export",
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      exportType: "named"
    } as any);
  }

  private extractVariable(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number, language: string): void {
    // Extract variable names from declarations
    const declarators = node.children.filter(child => child.type === "variable_declarator");
    
    for (const declarator of declarators) {
      const nameNode = declarator.childForFieldName("name");
      if (nameNode) {
        entities.push({
          type: "variable",
          name: nameNode.text,
          line: lineNumber,
          signature: this.getFirstLine(declarator.text),
          contextLines: getContextLines(lines, lineNumber, contextSize),
          filePath
        } as any);
      }
    }
  }

  // Rust entity extractors
  private extractRustFunction(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "function",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustStruct(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "struct",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustEnum(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "enum",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustTrait(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "trait",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustImpl(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const typeNode = node.childForFieldName("type");
    const traitNode = node.childForFieldName("trait");
    
    const typeName = typeNode?.text || "unknown";
    const traitName = traitNode?.text;
    const name = traitName ? `${traitName} for ${typeName}` : typeName;

    entities.push({
      type: "implementation",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustModule(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "module",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustUse(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const argumentNode = node.childForFieldName("argument");
    const imported = argumentNode?.text?.replace(/\s+as\s+\w+/, "").trim() || "unknown";

    entities.push({
      type: "import",
      name: imported,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustConst(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "constant",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustStatic(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "static",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  private extractRustTypeAlias(node: SyntaxNode, entities: CodeEntity[], filePath: string, lines: string[], lineNumber: number, contextSize: number): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text || "anonymous";

    entities.push({
      type: "type-alias",
      name,
      line: lineNumber,
      signature: this.getFirstLine(node.text),
      contextLines: getContextLines(lines, lineNumber, contextSize),
      filePath,
      language: "rust"
    } as any);
  }

  /**
   * Extract call expressions using tree-sitter
   * This replaces the TypeScript AST-based call expression extraction
   */
  private extractCallExpressions(rootNode: SyntaxNode, lines: string[]): CallExpression[] {
    const callExpressions: CallExpression[] = [];

    const extractFromNode = (node: SyntaxNode, containingFunction?: string) => {
      let currentContainingFunction = containingFunction;

      // Update containing function context
      if (node.type === "function_declaration" || node.type === "function_item" || node.type === "method_definition") {
        const nameNode = node.childForFieldName("name");
        currentContainingFunction = nameNode?.text || "anonymous";
      }

      // Extract call expressions
      if (node.type === "call_expression") {
        const { row: line } = node.startPosition;
        const lineNumber = line + 1;

        const functionNode = node.childForFieldName("function");
        let calleeName = "unknown";
        let calleeType = "unknown";

        if (functionNode) {
          if (functionNode.type === "identifier") {
            calleeName = functionNode.text;
            calleeType = "function";
          } else if (functionNode.type === "member_expression" || functionNode.type === "field_expression") {
            const objectNode = functionNode.childForFieldName("object");
            const propertyNode = functionNode.childForFieldName("property") || functionNode.childForFieldName("field");
            
            const objectName = objectNode?.text || "unknown";
            const propertyName = propertyNode?.text || "unknown";
            calleeName = `${objectName}.${propertyName}`;
            calleeType = "method";
          }
        }

        const argumentsNode = node.childForFieldName("arguments");
        const argumentCount = argumentsNode ? argumentsNode.namedChildCount : 0;

        callExpressions.push({
          callee: calleeName,
          type: calleeType as any,
          line: lineNumber,
          containingFunction: currentContainingFunction || null,
          signature: node.text,
          argumentCount
        });
      }

      // Recursively process child nodes
      for (let i = 0; i < node.childCount; i++) {
        extractFromNode(node.child(i)!, currentContainingFunction);
      }
    };

    extractFromNode(rootNode);
    return callExpressions;
  }

  /**
   * Extract type information using tree-sitter
   * This provides basic type information extraction
   */
  private extractTypeInformation(rootNode: SyntaxNode): TypeInformation {
    return {
      typeAliases: [],
      interfaces: [],
      classes: [],
      enums: [],
      typeReferences: []
    };
  }

  // Helper methods
  private hasExportModifier(node: SyntaxNode): boolean {
    // Check if node has export modifier
    let current = node.parent;
    while (current) {
      if (current.type === "export_statement" || current.type === "export_declaration") {
        return true;
      }
      current = current.parent;
    }
    
    // Also check for export keyword in node text (fallback)
    return node.text.includes("export");
  }

  private getFirstLine(text: string): string {
    return text.split("\n")[0].trim();
  }

  private extractImportNames(clauseNode: SyntaxNode, importNames: string[]): void {
    // Simplified import name extraction
    if (clauseNode.type === "import_specifier") {
      importNames.push(clauseNode.text);
    }
    
    for (let i = 0; i < clauseNode.childCount; i++) {
      const child = clauseNode.child(i)!;
      this.extractImportNames(child, importNames);
    }
  }
}

// Create a singleton instance for reuse
export const treeSitterWrapper = new TreeSitterWrapper();