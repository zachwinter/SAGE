// Main exports for analysis module

// Core Analysis Functions - Primary Public API
export { analyzeFiles } from "./engine/analyzer.js";
export { performCallTreeAnalysis } from "./engine/analyzers/call-graph.js";
export { performTopologicalSort } from "./engine/analyzers/dependency-sorter.js";
export { performTypeAnalysis } from "./engine/analyzers/type-hierarchy.js";

// File Discovery
export { getCodeFiles } from "./utils/file-finder.js";

// Presentation Layer - For Rendering Analysis Results
export {
  prepareCallTreeForRender,
  prepareTopologicalSortForRender,
  prepareTypeAnalysisForRender
} from "./presenters/render-service.js";

// Legacy compatibility - these functions now return render data instead of console.logging
export { prepareCallTreeForRender as renderCallTree } from "./presenters/render-service.js";
export { prepareTopologicalSortForRender as renderTopologicalSort } from "./presenters/render-service.js";
export { prepareTypeAnalysisForRender as renderTypeAnalysis } from "./presenters/render-service.js";

// Types for TypeScript consumers
export type {
  CodeEntity,
  FileAnalysisResult,
  CallGraphAnalysisResult,
  TopologicalSortResult,
  TypeAnalysisResult,
  AnalysisOptions,
  EntityFilter,
  RenderData
} from "./types.js";

// Advanced/Internal API - For power users who need fine-grained control
export { analyzeFile } from "./engine/analyzer.js";
export { getTypescriptFiles, getRustFiles } from "./utils/file-finder.js";

// Customizers - For advanced UI customization
export {
  callTreeCustomizer,
  reverseCallTreeCustomizer
} from "./presenters/customizers/call-tree.customizer.js";
export { topologicalTreeCustomizer } from "./presenters/customizers/topological-sort.customizer.js";
export { typeAnalysisCustomizer } from "./presenters/customizers/type-analysis.customizer.js";
export { codeEntityCustomizer } from "./presenters/customizers/code-entity.customizer.js";
export { fullCallTreeCustomizer } from "./presenters/customizers/full-call-tree.customizer.js";
