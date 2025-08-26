export { analyzeFiles } from "./engine/analyzer.js";
export { performCallTreeAnalysis } from "./engine/analyzers/call-graph.js";
export { performTopologicalSort } from "./engine/analyzers/dependency-sorter.js";
export { performTypeAnalysis } from "./engine/analyzers/type-hierarchy.js";

// NEW: Superior graph-native analyzer
export { analyzeToGraph } from "./engine/graph-analyzer.js";

export { getCodeFiles } from "./utils/file-finder.js";

// Export JSON export functionality (graph-native format)
export { exportGraphToJson, graphToJsonString } from "./export/json-exporter.js";

// Export Rust integration
export { RustKuzuIngestor } from "./graph/rust-ingestor.js";
export type { IngestStats } from "./graph/rust-ingestor.js";

export type {
  AnalysisOptions,
  CallGraphAnalysisResult,
  CodeEntity,
  EntityFilter,
  FileAnalysisResult,
  RenderData,
  TopologicalSortResult,
  TypeAnalysisResult,
  // Graph-native types (superior format)
  GraphEntity,
  GraphRelationship,
  AnalysisData
} from "./types.js";

export { analyzeFile } from "./engine/analyzer.js";
export { getRustFiles, getTypescriptFiles } from "./utils/file-finder.js";
