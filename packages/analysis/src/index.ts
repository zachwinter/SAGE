export { analyzeFiles } from "./engine/analyzer.js";
export { performCallTreeAnalysis } from "./engine/analyzers/call-graph.js";
export { performTopologicalSort } from "./engine/analyzers/dependency-sorter.js";
export { performTypeAnalysis } from "./engine/analyzers/type-hierarchy.js";

export { getCodeFiles } from "./utils/file-finder.js";

export type {
  AnalysisOptions,
  CallGraphAnalysisResult,
  CodeEntity,
  EntityFilter,
  FileAnalysisResult,
  RenderData,
  TopologicalSortResult,
  TypeAnalysisResult
} from "./types.js";

export { analyzeFile } from "./engine/analyzer.js";
export { getRustFiles, getTypescriptFiles } from "./utils/file-finder.js";
