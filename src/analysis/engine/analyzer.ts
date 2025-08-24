import fs from "fs";
import ts from "typescript";
import {
  extractEntitiesFromAST,
  extractCallExpressions,
  extractTypeInformation
} from "./parser/ts-ast-extractor.js";
import { analyzeRustFile } from "./parser/rust-regex-parser.js";
import type { AnalysisOptions, FileAnalysisResult } from "../types.js";

export function analyzeFiles(
  files: string[],
  options: AnalysisOptions = {}
): FileAnalysisResult[] {
  const results: FileAnalysisResult[] = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const analysis = analyzeFile(filePath, content, options);
      results.push(analysis);
    } catch (error) {
      // Only catch file system errors (file not found, permission denied, etc.)
      // Let other errors bubble up so they can be properly tested
      if (
        error instanceof Error &&
        (error.message.includes("ENOENT") ||
          error.message.includes("EACCES") ||
          error.message.includes("no such file"))
      ) {
        console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
      } else {
        // Re-throw non-filesystem errors
        throw error;
      }
    }
  }

  return results;
}

export function analyzeFile(
  filePath: string,
  content: string,
  options: AnalysisOptions = {}
): FileAnalysisResult {
  const createEmptyResult = (): FileAnalysisResult => ({
    filePath,
    entities: [],
    callExpressions: [],
    typeInfo: {
      typeAliases: [],
      interfaces: [],
      classes: [],
      enums: [],
      typeReferences: []
    },
    totalLines: content.split("\n").length
  });

  // Check if it's a Rust file
  if (filePath.endsWith(".rs")) {
    try {
      return analyzeRustFile(filePath, content, options);
    } catch (error) {
      console.warn(
        `Warning: Rust parsing failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return createEmptyResult();
    }
  }

  // Check if it's a known TypeScript/JavaScript file extension
  const tsExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const isTsFile = tsExtensions.some(ext => filePath.endsWith(ext));

  if (!isTsFile) {
    // For unrecognized file extensions, return empty result
    return createEmptyResult();
  }

  // Use TypeScript AST parsing directly
  try {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    if (!sourceFile) {
      console.warn(`Warning: Could not parse ${filePath}`);
      return createEmptyResult();
    }

    const entities = extractEntitiesFromAST(sourceFile, options);

    // Extract call expressions if requested
    let callExpressions: any[] = [];
    if (options.calls === true || typeof options.calls === "string") {
      callExpressions = extractCallExpressions(sourceFile);
    }

    // Extract type information if requested
    let typeInfo: any = {};
    if (options.types) {
      typeInfo = extractTypeInformation(sourceFile);
    }

    return {
      filePath,
      entities,
      callExpressions,
      typeInfo,
      totalLines: content.split("\n").length,
      sourceFile
    };
  } catch (error) {
    console.warn(
      `Warning: TypeScript AST parsing failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return createEmptyResult();
  }
}
