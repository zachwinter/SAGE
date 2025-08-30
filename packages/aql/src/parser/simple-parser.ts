// Simple AQL parser for Phase 1 - will be replaced with ANTLR later

import { AQLQuery, Operation, Parameter, AQLType } from "../types";
import { v4 as uuidv4 } from "uuid";

export class SimpleAQLParser {
  parse(aqlSource: string): AQLQuery {
    // Strip inline comments before parsing
    const strippedSource = this.stripInlineComments(aqlSource);
    
    // First, find the query declaration and its full parameter string
    const queryRegex = /query\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/;
    const queryMatch = strippedSource.match(queryRegex);

    if (!queryMatch) {
      // Fallback for queries with no parameters
      const noParamsMatch = strippedSource.match(/query\s+(\w+)\s*\{/);
      if (noParamsMatch) {
        return this.parseWithParameters(noParamsMatch[1], "", strippedSource);
      }
      throw new Error("Invalid query syntax: Could not find query declaration.");
    }

    return this.parseWithParameters(queryMatch[1], queryMatch[2], strippedSource);
  }

  private parseWithParameters(
    queryName: string,
    parametersStr: string,
    aqlSource: string
  ): AQLQuery {
    // Parse parameters from the potentially multi-line string
    const parameters = this.parseParameters(parametersStr);

    // Find operations between the first and last brace
    const openBrace = aqlSource.indexOf("{");
    const closeBrace = aqlSource.lastIndexOf("}");
    if (openBrace === -1 || closeBrace === -1) {
      throw new Error("Invalid query syntax: Missing braces.");
    }
    const operationsStr = aqlSource.slice(openBrace + 1, closeBrace);

    // Parse operations
    const operations = this.parseOperations(operationsStr);

    return {
      name: queryName,
      parameters,
      operations
    };
  }

  private parseParameters(parametersStr: string): Parameter[] {
    if (!parametersStr.trim()) return [];

    // Remove newlines and split by comma, then trim each part.
    const params = parametersStr
      .replace(/\n/g, " ")
      .split(",")
      .map(p => p.trim())
      .filter(p => p);

    return params.map(param => {
      // Regex to handle types, default values, and required marker.
      const match = param.match(
        /(\$\w+)\s*:\s*(\[?\s*\w+\s*\]?)\s*(?:=\s*(.+))?(!)?/
      );
      if (!match) {
        throw new Error(`Invalid parameter syntax: ${param}`);
      }

      let [, name, typeName, defaultValue, required] = match;

      // Clean up typeName from whitespace
      typeName = typeName.replace(/\s/g, "");

      return {
        name: name.slice(1), // Remove $
        type: this.parseType(typeName),
        defaultValue: defaultValue
          ? this.parseValue(defaultValue.trim())
          : undefined,
        required: !!required
      };
    });
  }

  private parseType(typeName: string): AQLType {
    if (typeName.startsWith("[") && typeName.endsWith("]")) {
      const elementTypeName = typeName.slice(1, -1);
      return {
        kind: "collection",
        name: typeName,
        elementType: this.parseType(elementTypeName)
      };
    }

    if (["String", "Int", "Float", "Boolean"].includes(typeName)) {
      return {
        kind: "primitive",
        name: typeName
      };
    }

    return {
      kind: "custom",
      name: typeName
    };
  }

  private parseValue(valueStr: string): any {
    if (valueStr === "true") return true;
    if (valueStr === "false") return false;
    if (/^-?\d+$/.test(valueStr)) return parseInt(valueStr, 10);
    if (/^-?\d*\.\d+$/.test(valueStr)) return parseFloat(valueStr);

    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("`") && valueStr.endsWith("`"))
    ) {
      return this.unescapeString(valueStr.slice(1, -1));
    }

    return valueStr;
  }

  private unescapeString(raw: string): string {
    return raw
      .replace(/\\\\/g, "\\") // must come first
      .replace(/\\"/g, '"') // double quote
      .replace(/\\`/g, "`") // backtick
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\b/g, "\b");
  }

  private parseOperations(
    operationsStr: string,
    seenAliases: Set<string> = new Set()
  ): Operation[] {
    const operations: Operation[] = [];
    const lines = operationsStr
      .split("\n")
      .map(line => line.trim())
      .filter(line => line);

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.includes(":") && line.includes("agent(")) {
        const { operation, nextIndex } = this.parseAgentOperation(lines, i);
        if (operation.name) {
          if (seenAliases.has(operation.name)) {
            throw new Error(`Alias "${operation.name}" is already defined.`);
          }
          seenAliases.add(operation.name);
        }
        operations.push(operation);
        i = nextIndex;
      } else if (line.includes("parallel")) {
        const { operation, nextIndex } = this.parseParallelOperation(
          lines,
          i,
          seenAliases
        );
        if (operation.name) {
          if (seenAliases.has(operation.name)) {
            throw new Error(`Alias "${operation.name}" is already defined.`);
          }
          seenAliases.add(operation.name);
        }
        operations.push(operation);
        i = nextIndex;
      } else if (line.includes("sequential")) {
        const { operation, nextIndex } = this.parseSequentialOperation(
          lines,
          i,
          seenAliases
        );
        if (operation.name) {
          if (seenAliases.has(operation.name)) {
            throw new Error(`Alias "${operation.name}" is already defined.`);
          }
          seenAliases.add(operation.name);
        }
        operations.push(operation);
        i = nextIndex;
      } else {
        i++;
      }
    }

    return operations;
  }

  private parseAgentInline(
    match: RegExpMatchArray,
    startIndex: number,
    lines: string[]
  ): { operation: Operation; nextIndex: number } {
    const operationName = match[1];
    const agentParamsStr = match[2];
    const agentParams = this.parseAgentParams(agentParamsStr);

    const currentLine = lines[startIndex];

    // Check if this is a single-line operation (contains both opening and closing braces)
    const openBraces = (currentLine.match(/\{/g) || []).length;
    const closeBraces = (currentLine.match(/\}/g) || []).length;

    if (openBraces > 0 && openBraces === closeBraces) {
      // Single-line operation
      const openBraceIndex = currentLine.indexOf("{");
      const closeBraceIndex = currentLine.lastIndexOf("}");
      const bodyContent = currentLine.slice(openBraceIndex + 1, closeBraceIndex);
      const bodyParams = this.parseAgentBody([bodyContent].filter(l => l.trim()));

      const operation: Operation = {
        id: uuidv4(),
        type: "agent",
        name: operationName,
        config: {
          ...agentParams,
          ...bodyParams
        },
        dependencies: this.extractDependencies(bodyParams.input)
      };

      return { operation, nextIndex: startIndex + 1 };
    }

    // Multi-line operation (existing logic)
    const blockLines: string[] = [];
    let braceCount = openBraces; // Use actual brace count from current line
    blockLines.push(currentLine); // Include the current line

    let j = startIndex + 1;
    for (; j < lines.length && braceCount > 0; j++) {
      const nextLine = lines[j];
      blockLines.push(nextLine);
      braceCount += (nextLine.match(/\{/g) || []).length;
      braceCount -= (nextLine.match(/\}/g) || []).length;
    }

    const nextIndex = j;
    const blockStr = blockLines.join("\n");
    const bodyContent = blockStr.substring(
      blockStr.indexOf("{") + 1,
      blockStr.lastIndexOf("}")
    );
    const bodyParams = this.parseAgentBody(
      bodyContent.split("\n").map(l => l.trim())
    );

    const operation: Operation = {
      id: uuidv4(),
      type: "agent",
      name: operationName,
      config: {
        ...agentParams,
        ...bodyParams
      },
      dependencies: this.extractDependencies(bodyParams.input)
    };

    return { operation, nextIndex };
  }

  private parseAgentOperation(
    lines: string[],
    startIndex: number
  ): { operation: Operation; nextIndex: number } {
    let i = startIndex;

    // Step 1: Parse the alias and make sure it's followed by 'agent(' somewhere
    let aliasLine = lines[i];
    const aliasMatch = aliasLine.match(/^(\w+):\s*$/);
    let operationName: string | undefined;

    if (aliasMatch) {
      operationName = aliasMatch[1];
      i++;
    } else {
      const inlineMatch = aliasLine.match(/^(\w+):\s*agent\((.*)\)\s*\{/);
      if (inlineMatch) {
        operationName = inlineMatch[1];
        // We already have the full line — can parse here if needed
        return this.parseAgentInline(inlineMatch, i, lines);
      }
    }

    // Step 2: Accumulate lines until we get the full agent(...) {
    let signature = lines[i];
    let braceFound = signature.includes("{");
    while (!braceFound && i + 1 < lines.length) {
      i++;
      signature += " " + lines[i];
      braceFound = lines[i].includes("{");
    }

    const match = signature.match(/agent\(([^)]*)\)\s*\{/);
    if (!match) {
      throw new Error(`Invalid agent operation syntax: ${signature}`);
    }

    const agentParamsStr = match[1];
    const agentParams = this.parseAgentParams(agentParamsStr);

    // Step 3: Get the block (like before)
    const blockLines: string[] = [lines[i]];
    let braceCount =
      (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
    let j = i + 1;
    for (; j < lines.length && braceCount > 0; j++) {
      const currentLine = lines[j];
      blockLines.push(currentLine);
      braceCount += (currentLine.match(/\{/g) || []).length;
      braceCount -= (currentLine.match(/\}/g) || []).length;
    }

    const nextIndex = j;
    const blockStr = blockLines.join("\n");
    const bodyContent = blockStr.substring(
      blockStr.indexOf("{") + 1,
      blockStr.lastIndexOf("}")
    );
    const bodyParams = this.parseAgentBody(
      bodyContent.split("\n").map(l => l.trim())
    );

    const operation: Operation = {
      id: uuidv4(),
      type: "agent",
      name: operationName,
      config: {
        ...agentParams,
        ...bodyParams
      },
      dependencies: this.extractDependencies(bodyParams.input)
    };

    return { operation, nextIndex };
  }

  private parseSequentialOperation(
    lines: string[],
    startIndex: number,
    seenAliases: Set<string>
  ): { operation: Operation; nextIndex: number } {
    const firstLine = lines[startIndex];
    const match = firstLine.match(/(?:(\w+):\s*)?sequential\s*\{/);
    if (!match) {
      throw new Error(`Invalid sequential operation syntax: ${firstLine}`);
    }
    const operationName = match[1];

    // Find all lines belonging to this block
    const blockLines: string[] = [];
    let braceCount = 0;
    let i = startIndex;
    for (; i < lines.length; i++) {
      const currentLine = lines[i];
      blockLines.push(currentLine);
      braceCount += (currentLine.match(/\{/g) || []).length;
      braceCount -= (currentLine.match(/\}/g) || []).length;
      if (braceCount === 0) {
        break;
      }
    }
    const nextIndex = i + 1;

    const blockStr = blockLines.join("\n");
    const bodyContent = blockStr.substring(
      blockStr.indexOf("{") + 1,
      blockStr.lastIndexOf("}")
    );

    const sequentialOps = this.parseOperations(bodyContent, seenAliases);

    const operation: Operation = {
      id: uuidv4(),
      type: "sequential",
      name: operationName,
      config: {
        operations: sequentialOps
      },
      dependencies: []
    };

    return { operation, nextIndex };
  }

  private parseParallelOperation(
    lines: string[],
    startIndex: number,
    seenAliases: Set<string>
  ): { operation: Operation; nextIndex: number } {
    const firstLine = lines[startIndex];
    const match = firstLine.match(/(?:(\w+):\s*)?parallel\s*\{/);
    if (!match) {
      throw new Error(`Invalid parallel operation syntax: ${firstLine}`);
    }
    const operationName = match[1];

    // Find all lines belonging to this block
    const blockLines: string[] = [];
    let braceCount = 0;
    let i = startIndex;
    for (; i < lines.length; i++) {
      const currentLine = lines[i];
      blockLines.push(currentLine);
      braceCount += (currentLine.match(/\{/g) || []).length;
      braceCount -= (currentLine.match(/\}/g) || []).length;
      if (braceCount === 0) {
        break;
      }
    }
    const nextIndex = i + 1;

    const blockStr = blockLines.join("\n");
    const bodyContent = blockStr.substring(
      blockStr.indexOf("{") + 1,
      blockStr.lastIndexOf("}")
    );

    const parallelOps = this.parseOperations(bodyContent, seenAliases);

    const operation: Operation = {
      id: uuidv4(),
      type: "parallel",
      name: operationName,
      config: {
        operations: parallelOps
      },
      dependencies: []
    };

    return { operation, nextIndex };
  }

  private parseAgentParams(paramsStr: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Simple parsing - split by comma but respect quotes
    const paramPairs = this.splitParams(paramsStr);

    for (const pair of paramPairs) {
      const colonIndex = this.findFirstUnquotedColon(pair);
      if (colonIndex === -1) continue;

      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();

      if (key && value) {
        params[key] = this.parseValue(value);
      }
    }

    return params;
  }

  private parseAgentBody(bodyLines: string[]): Record<string, any> {
    const params: Record<string, any> = {};
    let i = 0;

    while (i < bodyLines.length) {
      const line = bodyLines[i];
      const colonIndex = this.findFirstUnquotedColon(line);
      if (colonIndex === -1) {
        i++;
        continue;
      }

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Check if it's a multiline backtick string
      if (value.startsWith("`") && !value.endsWith("`")) {
        while (i + 1 < bodyLines.length && !bodyLines[i + 1].trim().endsWith("`")) {
          value += "\n" + bodyLines[++i].trim();
        }
        if (i + 1 < bodyLines.length) {
          value += "\n" + bodyLines[++i].trim(); // Add the final line
        }
      }

      params[key] = this.parseValue(value);
      i++;
    }

    return params;
  }

  private splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        current += char;
      } else if (char === "," && !inQuotes) {
        if (current.trim()) {
          params.push(current.trim());
        }
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current.trim());
    }

    return params;
  }

  private extractDependencies(input: string | string[] | undefined): string[] {
    if (!input) return [];

    const dependencies: string[] = [];
    const inputs = Array.isArray(input) ? input : [input];

    for (const inp of inputs) {
      if (typeof inp === "string" && !inp.startsWith("$") && !inp.startsWith('"')) {
        // This might be a reference to another operation
        dependencies.push(inp);
      }
    }

    return dependencies;
  }

  private findFirstUnquotedColon(str: string): number {
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
      } else if (char === ":" && !inQuotes) {
        return i;
      }
    }

    return -1;
  }

  private stripInlineComments(source: string): string {
    // Remove inline comments (starting with //) but preserve strings
    let result = '';
    let inString = false;
    let stringChar = '';
    let i = 0;
    
    while (i < source.length) {
      const char = source[i];
      const nextChar = i + 1 < source.length ? source[i + 1] : '';
      
      // Handle string literals
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (inString && char === stringChar) {
        // Handle escaped quotes
        if (i > 0 && source[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        }
        result += char;
      } else if (!inString && char === '/' && nextChar === '/') {
        // Skip the rest of the line (inline comment)
        while (i < source.length && source[i] !== '\n') {
          i++;
        }
        // Add the newline character if it exists
        if (i < source.length && source[i] === '\n') {
          result += '\n';
        }
        continue;
      } else {
        result += char;
      }
      
      i++;
    }
    
    return result;
  }
}
