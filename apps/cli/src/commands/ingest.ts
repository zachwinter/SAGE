import { RustKuzuIngestor, analyzeToGraph, getCodeFiles } from "@sage/analysis";
import { rmSync } from "fs";
import { join } from "path";
import { PrettyTask, PrettyTaskList } from "../utils/prettyTask";

export async function ingest(options: { debug?: boolean } = {}) {
  const { debug = false } = options;

  try {
    const allFiles = getCodeFiles(process.cwd());
    const dbPath = join(process.cwd(), ".sage", "code.kuzu");

    const taskList = new PrettyTaskList("Ingesting", process.cwd())
      .addTask({
        title: "analyzing",
        subtitle: `${allFiles.length} files`,
        fn: async (task, taskList) => {
          if (allFiles.length === 0) {
            task.log("No TypeScript or Rust files found in current directory.");
            return null;
          }

          const analysisData = analyzeToGraph(allFiles, { debug });

          // Show analysis results
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

          const nodes = PrettyTask.formatCount(
            analysisData.entities.length,
            "nodes"
          );
          const relationships = PrettyTask.formatCount(
            analysisData.relationships.length,
            "relationships"
          );

          return { analysisData, summary: `${nodes} & ${relationships}` };
        }
      })
      .addTask({
        title: "populating",
        subtitle: `${dbPath.replace(process.cwd() + "/", "")}`,
        fn: async (task, taskList) => {
          const result = taskList.results[0]; // Get analysis result from previous task
          if (!result) throw new Error("Analysis failed");

          const { analysisData } = result;

          if (debug) task.log("Cleaning existing database...");
          rmSync(dbPath, { force: true });

          if (debug) task.log("Initializing Kuzu database...");
          const ingestor = new RustKuzuIngestor(dbPath);
          await ingestor.initialize();

          if (debug) task.log("Ingesting data into database...");
          const { entities, relationships } =
            await ingestor.ingestStream(analysisData);

          if (debug) task.log("Closing database connection...");
          await ingestor.close();

          const entitiesFormatted = PrettyTask.formatCount(entities, "entities");
          const relationshipsFormatted = PrettyTask.formatCount(
            relationships,
            "relationships"
          );

          return {
            entities,
            relationships,
            summary: `${entitiesFormatted} & ${relationshipsFormatted}`
          };
        }
      });

    await taskList.execute();
  } catch (error) {
    console.error("❌ Ingest failed:", error);
    process.exit(1);
  }
}
