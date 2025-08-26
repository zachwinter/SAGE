import { analyzeToGraph, getCodeFiles, RustKuzuIngestor } from "@sage/analysis";
import { join } from "path";
import { rmSync, existsSync } from "fs";

export async function ingest() {
  try {
    const allFiles = getCodeFiles(process.cwd());

    if (allFiles.length === 0) {
      console.log("No TypeScript or Rust files found in current directory.");
      return;
    }

    console.log(`📁 Found ${allFiles.length} code files to analyze`);
    
    // Use persistent database in .sage directory
    const dbPath = join(process.cwd(), '.sage', 'code.kuzu');
    
    // Clean up existing database for fresh analysis
    if (existsSync(dbPath)) {
      console.log(`🧹 Cleaning existing database...`);
      rmSync(dbPath, { force: true });
    }
    
    console.log(`🗄️  Database: ${dbPath}`);
    
    const analysisData = analyzeToGraph(allFiles);
    console.log(`🔍 Analysis found ${analysisData.entities.length} entities and ${analysisData.relationships.length} relationships`);
    
    const ingestor = new RustKuzuIngestor(dbPath);
    await ingestor.initialize();
    
    const stats = await ingestor.ingestStream(analysisData);
    
    console.log("✅ Ingestion completed successfully!");
    console.log(`   📊 Entities: ${stats.entities}`);
    console.log(`   🔗 Relationships: ${stats.relationships}`);
    console.log(`   ⏱️  Duration: ${stats.duration}ms`);
    console.log(`   🗄️  Saved to: ${dbPath}`);
    
    await ingestor.close();
  } catch (error) {
    console.error("❌ Ingest failed:", error);
    process.exit(1);
  }
}
