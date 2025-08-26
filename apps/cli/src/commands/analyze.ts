import { analyzeToGraph, getCodeFiles } from "@sage/analysis";
import { PrettyTask } from "../utils/prettyTask";

export async function runAnalysis(options: { debug?: boolean } = {}) {
  const { debug } = { debug: false };

  const allFiles = getCodeFiles(process.cwd());
  const task = new PrettyTask({
    title: "analyzing",
    subtitle: `${allFiles.length} files`,
    location: process.cwd()
  });

  if (allFiles.length === 0) {
    task.log("No TypeScript or Rust files found in current directory.");
    return null;
  }

  const analysisData = analyzeToGraph(allFiles, { debug });

  return { allFiles, analysisData, task };
}

export async function analyze(options: { debug?: boolean; format?: string } = {}) {
  const { debug = false, format = "summary" } = options;

  try {
    const result = await runAnalysis({ debug });
    if (!result) return;

    const { analysisData, task } = result;

    if (format === "json") {
      console.log(JSON.stringify(analysisData, null, 2));
    } else {
      // Summary format - break down entities by type
      const entityCounts = analysisData.entities.reduce(
        (counts, entity) => {
          counts[entity.kind] = (counts[entity.kind] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );

      const relationshipCounts = analysisData.relationships.reduce(
        (counts, rel) => {
          counts[rel.type] = (counts[rel.type] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );

      task.logDim("Nodes");
      Object.entries(entityCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => task.logKeyValue(type, count, "(:", ")"));

      task.logDim("Relationships");
      Object.entries(relationshipCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          task.logKeyValue(type, count, "[:", "]");
        });

      const nodes = PrettyTask.formatCount(analysisData.entities.length, "nodes");
      const relationships = PrettyTask.formatCount(
        analysisData.relationships.length,
        "relationships"
      );

      task.finish(`found ${nodes} & ${relationships} in {time}`);
    }
  } catch (error) {
    console.error("❌ analysis failed:", error);
    process.exit(1);
  }
}
