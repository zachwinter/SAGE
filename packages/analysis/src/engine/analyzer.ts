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
  const { debug = false } = options;
  const results: FileAnalysisResult[] = [];

  if (debug) console.log(`🐛 Analyzing ${files.length} files...`);

  for (const filePath of files) {
    try {
      // Check if path is a directory before attempting to read it
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (debug) console.log(`🐛 Skipping directory: ${filePath}`);
        console.warn(`Warning: Skipping directory ${filePath} (expected file)`);
        continue;
      }
      
      if (debug) console.log(`🐛 Processing file: ${filePath}`);
      const content = fs.readFileSync(filePath, "utf8");
      const analysis = analyzeFile(filePath, content, options);
      results.push(analysis);
      
      if (debug) {
        console.log(`🐛   Found ${analysis.entities.length} entities, ${analysis.callExpressions.length} calls`);
      }
    } catch (error) {
      // Only catch file system errors (file not found, permission denied, etc.)
      // Let other errors bubble up so they can be properly tested
      if (
        error instanceof Error &&
        (error.message.includes("ENOENT") ||
          error.message.includes("EACCES") ||
          error.message.includes("EISDIR") ||
          error.message.includes("no such file"))
      ) {
        if (debug) console.log(`🐛 Error reading file ${filePath}: ${error.message}`);
        console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
      } else {
        // Re-throw non-filesystem errors
        throw error;
      }
    }
  }

  if (debug) console.log(`🐛 Analysis complete: ${results.length} files processed`);
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

    // Always extract call expressions
    let callExpressions: any[] = [];
    try {
      callExpressions = extractCallExpressions(sourceFile) || [];
    } catch (error) {
      // Silently handle errors in call expression extraction
      callExpressions = [];
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
