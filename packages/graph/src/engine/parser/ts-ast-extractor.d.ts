import ts from "typescript";
import type { AnalysisOptions, CodeEntity, CallExpression, TypeInformation } from "../../types.js";
export declare function extractEntitiesFromAST(sourceFile: ts.SourceFile, options?: AnalysisOptions): CodeEntity[];
export declare function extractCallExpressions(sourceFile: ts.SourceFile): CallExpression[];
export declare function extractTypeInformation(sourceFile: ts.SourceFile): TypeInformation;
//# sourceMappingURL=ts-ast-extractor.d.ts.map