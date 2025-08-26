import { analyzeToGraph, getCodeFiles, RustKuzuIngestor } from "@sage/analysis";
import { rmSync } from "fs";
import { join } from "path";

export async function ingest(options: { debug?: boolean } = {}) {
  const { debug = false } = options;
  const start = Date.now();
  
  if (debug) {
    console.log("🐛 Debug mode enabled");
    console.log(`🐛 Working directory: ${process.cwd()}`);
  }
  
  try {
    if (debug) console.log("🐛 Finding code files...");
    const allFiles = getCodeFiles(process.cwd());

    if (debug) {
      console.log(`🐛 Found ${allFiles.length} files:`);
      allFiles.slice(0, 10).forEach(file => console.log(`🐛   - ${file}`));
      if (allFiles.length > 10) {
        console.log(`🐛   ... and ${allFiles.length - 10} more files`);
      }
    }

    if (allFiles.length === 0) {
      console.log("No TypeScript or Rust files found in current directory.");
      return;
    }

    const dbPath = join(process.cwd(), ".sage", "code.kuzu");
    if (debug) console.log(`🐛 Database path: ${dbPath}`);

    if (debug) console.log("🐛 Cleaning existing database...");
    rmSync(dbPath, { force: true });

    if (debug) console.log("🐛 Starting code analysis...");
    const analysisData = analyzeToGraph(allFiles, { debug });
    
    if (debug) {
      console.log(`🐛 Analysis complete - found ${analysisData.entities.length} entities and ${analysisData.relationships.length} relationships`);
    }
    
    if (debug) console.log("🐛 Initializing Kuzu database...");
    const ingestor = new RustKuzuIngestor(dbPath);
    await ingestor.initialize();

    if (debug) console.log("🐛 Ingesting data into database...");
    const { entities, relationships } = await ingestor.ingestStream(analysisData);

    if (debug) console.log("🐛 Closing database connection...");
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
