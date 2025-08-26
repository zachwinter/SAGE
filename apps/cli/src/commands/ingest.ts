import { analyzeToGraph, getCodeFiles, RustKuzuIngestor } from "@sage/analysis";
import { rmSync } from "fs";
import { join } from "path";

export async function ingest() {
  const start = Date.now();
  try {
    const allFiles = getCodeFiles(process.cwd());

    if (allFiles.length === 0) {
      console.log("No TypeScript or Rust files found in current directory.");
      return;
    }

    const dbPath = join(process.cwd(), ".sage", "code.kuzu");

    rmSync(dbPath, { force: true });

    const analysisData = analyzeToGraph(allFiles);
    const ingestor = new RustKuzuIngestor(dbPath);
    await ingestor.initialize();

    const { entities, relationships } = await ingestor.ingestStream(analysisData);

    await ingestor.close();
    const end = Date.now();
    const duration = Number(((end - start) / 1000).toFixed(2));

    console.log(
      `Ingested`,
      allFiles.length,
      `files`,
      "(",
      entities,
      "entities,",
      relationships,
      "relationships",
      ")",
      `in`,
      duration,
      `seconds.`
    );
  } catch (error) {
    console.error("❌ Ingest failed:", error);
    process.exit(1);
  }
}
