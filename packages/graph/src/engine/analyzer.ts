import chalk from "chalk";
import fs from "fs";
import ts from "typescript";
import type { AnalysisOptions, FileAnalysisResult } from "../types.js";
import {
  extractCallExpressions,
  extractEntitiesFromAST,
  extractTypeInformation
} from "./parser/ts-ast-extractor.js";

const line = chalk.magenta("│");
export function analyzeFiles(
  files: string[],
  options: AnalysisOptions = {}
): FileAnalysisResult[] {
  const { debug = false } = options;
  const results: FileAnalysisResult[] = [];
  const cwd = process.cwd();

  if (debug) console.log(line, `Analyzing ${files.length} files...`);

  for (const filePath of files) {
    try {
      // Check if path is a directory before attempting to read it
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (debug) console.log(line, `Skipping directory: ${filePath}`);
        console.warn(
          line,
          `Warning: Skipping directory ${filePath} (expected file)`
        );
        continue;
      }

      const content = fs.readFileSync(filePath, "utf8");
      const analysis = analyzeFile(filePath, content, options);
      results.push(analysis);

      if (debug) {
        console.log(
          line,
          analysis.entities.length,
          "entities",
          analysis.callExpressions.length,
          "calls in",
          filePath.replace(cwd + "/", "")
        );
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
        if (debug)
          console.log(line, `Error reading file ${filePath}: ${error.message}`);
        console.warn(
          line,
          `Warning: Could not read file ${filePath}: ${error.message}`
        );
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

  // Skip Rust files - they'll be handled by Rust analysis later
  if (filePath.endsWith(".rs")) {
    return createEmptyResult();
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
      console.warn(line, `Warning: Could not parse ${filePath}`);
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
      line,
      `Warning: TypeScript AST parsing failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return createEmptyResult();
  }
}
