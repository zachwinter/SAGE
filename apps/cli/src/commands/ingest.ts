import { analyzeToGraph, getCodeFiles, RustKuzuIngestor } from "@sage/graph";
import { mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import {
  PrettyTask,
  PrettyTaskList
} from "../../../../packages/utils/src/prettyTask";

type IngestOptions = { debug?: boolean; batchSize?: number };

export async function ingest(options: IngestOptions = {}) {
  const { debug = false, batchSize = 10_000 } = options;

  try {
    const cwd = process.cwd();
    const allFiles = getCodeFiles(cwd);
    const dbPath = join(cwd, ".sage", "code.kuzu");
    const dbDir = dirname(dbPath);

    const taskList = new PrettyTaskList("Ingesting", cwd)
      .addTask({
        title: "analyzing",
        subtitle: `${allFiles.length} files`,
        fn: async task => {
          if (allFiles.length === 0) {
            task.log("No TypeScript or Rust files found in current directory.");
            return { analysisData: null, summary: "no files" as const };
          }

          const analysisData = analyzeToGraph(allFiles, { debug });

          const countBy = <T extends string>(
            items: Array<{ [K in T]: string }>,
            key: T
          ) =>
            items.reduce<Record<string, number>>((acc, item) => {
              const k = item[key] as unknown as string;
              acc[k] = (acc[k] || 0) + 1;
              return acc;
            }, {});

          const entityCounts = countBy(analysisData.entities as any, "kind");
          const relationshipCounts = countBy(
            analysisData.relationships as any,
            "type"
          );

          task.logDim("Nodes");
          Object.entries(entityCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => task.logKeyValue(type, count, "(:", ")"));

          task.logDim("Relationships");
          Object.entries(relationshipCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => task.logKeyValue(type, count, "[:", "]"));

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
        subtitle: dbPath.replace(cwd + "/", ""),
        fn: async (task, tl) => {
          const prev = tl.results[0] as {
            analysisData: any;
            summary: string;
          } | null;

          if (!prev || !prev.analysisData) {
            throw new Error("Analysis failed or returned no data");
          }

          const { analysisData } = prev;

          // Fresh DB dir
          if (debug) task.log("Resetting Kùzu database directory...");
          try {
            rmSync(dbDir, { recursive: true, force: true });
            mkdirSync(dbDir, { recursive: true });
          } catch (err) {
            if (debug) task.log(`Database cleanup warning: ${err}`);
          }

          const ingestor = new RustKuzuIngestor(dbPath);
          const startedAt = Date.now();

          try {
            if (debug) task.log("Initializing Kùzu database...");
            await ingestor.initialize();

            if (debug) task.log("Starting Kùzu ingestion server...");
            // await ingestor.startServer();

            if (debug)
              task.log(
                `Ingesting via server mode (batchSize=${batchSize.toLocaleString()})...`
              );

            const stats = await ingestor.ingestStream(analysisData);

            const duration =
              typeof stats?.duration === "number"
                ? stats.duration
                : Date.now() - startedAt;

            task.log(
              `Ingested ${stats.entities} entities and ${stats.relationships} relationships in ${duration}ms`
            );

            const entitiesFormatted = PrettyTask.formatCount(
              stats.entities,
              "entities"
            );
            const relationshipsFormatted = PrettyTask.formatCount(
              stats.relationships,
              "relationships"
            );

            return {
              entities: stats.entities,
              relationships: stats.relationships,
              summary: `${entitiesFormatted} & ${relationshipsFormatted}`
            };
          } finally {
            // Always attempt to stop the server
            try {
              if (debug) task.log("Stopping Kùzu ingestion server...");
              await ingestor.stopServer();
            } catch (err) {
              if (debug) task.log(`Server shutdown warning: ${err}`);
            }
          }
        }
      });

    await taskList.execute();
  } catch (error) {
    console.error("❌ Ingest failed:", error);
    // Let callers decide how to handle failures (don’t exit in library code)
    throw error;
  }
}
