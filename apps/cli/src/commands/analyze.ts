import { analyzeToGraph, getCodeFiles } from "@sage/analysis";

export async function analyze(options: { debug?: boolean; format?: string } = {}) {
  const { debug = false, format = 'summary' } = options;
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

    if (debug) console.log("🐛 Starting code analysis...");
    const analysisData = analyzeToGraph(allFiles, { debug });
    
    const end = Date.now();
    const duration = Number(((end - start) / 1000).toFixed(2));

    if (format === 'json') {
      console.log(JSON.stringify(analysisData, null, 2));
    } else {
      // Summary format - break down entities by type
      const entityCounts = analysisData.entities.reduce((counts, entity) => {
        counts[entity.kind] = (counts[entity.kind] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      const relationshipCounts = analysisData.relationships.reduce((counts, rel) => {
        counts[rel.type] = (counts[rel.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      console.log(
        `Analyzed`,
        allFiles.length,
        `files in`,
        duration,
        `seconds.`
      );
      console.log(
        `Found`,
        analysisData.entities.length,
        `entities and`,
        analysisData.relationships.length,
        `relationships.`
      );
      
      console.log("\nEntities by type:");
      Object.entries(entityCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => console.log(`  ${type}: ${count}`));
      
      console.log("\nRelationships by type:");
      Object.entries(relationshipCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => console.log(`  ${type}: ${count}`));
    }
  } catch (error) {
    console.error("❌ Analysis failed:", error);
    process.exit(1);
  }
}