import { resolve } from "path";
import type {
  FileAnalysisResult,
  AnalysisOptions,
  CallGraphAnalysisResult
} from "../../types.js";

// Check if a function is a built-in
function isBuiltinFunction(funcName: string): boolean {
  const builtins = [
    "console.log",
    "console.error",
    "console.warn",
    "console.info",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "JSON.parse",
    "JSON.stringify",
    "Object.keys",
    "Object.values",
    "Object.entries",
    "Array.isArray",
    "Promise.resolve",
    "Promise.reject"
  ];
  return builtins.includes(funcName) || funcName.includes("Math.");
}

// Perform call tree analysis
export function performCallTreeAnalysis(
  analysisResults: FileAnalysisResult[],
  options: AnalysisOptions = {}
): CallGraphAnalysisResult {
  const callGraph = new Map<string, Set<string>>(); // function -> Set of functions it calls
  const reverseCallGraph = new Map<string, Set<string>>(); // function -> Set of functions that call it
  const allFunctions = new Set<string>();

  // Build the call graph
  for (const fileResult of analysisResults) {
    // Add all functions from this file
    fileResult.entities
      .filter(e => e.type === "function")
      .forEach(func => {
        const funcId = `${fileResult.filePath}:${func.name}`;
        allFunctions.add(funcId);
        if (!callGraph.has(funcId)) {
          callGraph.set(funcId, new Set<string>());
          reverseCallGraph.set(funcId, new Set<string>());
        }
      });

    // Process call expressions
    for (const callExpr of fileResult.callExpressions || []) {
      if (!callExpr.containingFunction) continue;

      const callerFuncId = `${fileResult.filePath}:${callExpr.containingFunction}`;

      // Try to find the target function
      let targetFuncId = null;

      // First check if it's a built-in or external call
      const isBuiltin = isBuiltinFunction(callExpr.callee);
      if (isBuiltin && !options.showBuiltin) continue;

      // Look for the function in the same file first
      const localFunc = fileResult.entities.find(
        e => e.type === "function" && e.name === callExpr.callee
      );
      if (localFunc) {
        targetFuncId = `${fileResult.filePath}:${localFunc.name}`;
      } else {
        // Look in other files
        for (const otherFile of analysisResults) {
          const func = otherFile.entities.find(
            e => e.type === "function" && e.name === callExpr.callee
          );
          if (func) {
            targetFuncId = `${otherFile.filePath}:${func.name}`;
            break;
          }
        }
      }

      // If we couldn't find the target, create an external reference
      if (!targetFuncId) {
        targetFuncId = `external:${callExpr.callee}`;
      }

      // Add to call graphs
      if (!callGraph.has(callerFuncId)) {
        callGraph.set(callerFuncId, new Set<string>());
      }
      if (!reverseCallGraph.has(targetFuncId)) {
        reverseCallGraph.set(targetFuncId, new Set<string>());
      }

      callGraph.get(callerFuncId).add(targetFuncId);
      reverseCallGraph.get(targetFuncId).add(callerFuncId);
    }
  }

  return {
    callGraph,
    reverseCallGraph,
    allFunctions,
    analysisResults
  };
}
