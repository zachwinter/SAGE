import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { AnalysisData } from "../types.js";

/**
 * Export graph analysis data to JSON format (matches Rust format exactly)
 */
export function exportGraphToJson(
  analysisData: AnalysisData,
  outputPath?: string
): string {
  const jsonPath = outputPath || join(tmpdir(), `analysis-${Date.now()}.json`);
  writeFileSync(jsonPath, JSON.stringify(analysisData, null, 2));
  return jsonPath;
}

/**
 * Export graph analysis data to JSON string
 */
export function graphToJsonString(analysisData: AnalysisData): string {
  return JSON.stringify(analysisData, null, 2);
}
