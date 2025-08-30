import { RustKuzuClient } from "@sage/graph";
import { join } from "path";

type QueryOptions = { 
  debug?: boolean; 
  format?: "json" | "table";
  database?: string;
};

export async function query(cypherQuery: string, options: QueryOptions = {}) {
  const { debug = false, format = "table", database } = options;
  
  try {
    const cwd = process.cwd();
    const dbPath = database || join(cwd, ".sage", "code.kuzu");
    
    const client = new RustKuzuClient({ debug });
    
    // Check if database exists
    const dbExists = await client.databaseExists(dbPath);
    if (!dbExists) {
      console.error(`❌ Database not found at ${dbPath}`);
      console.error("💡 Run 'sage ingest' first to create the database");
      process.exit(1);
    }
    
    if (debug) {
      console.log(`🔍 Querying database: ${dbPath}`);
      console.log(`📝 Query: ${cypherQuery}`);
    }
    
    const result = await client.query(dbPath, cypherQuery);
    
    if (result.error) {
      console.error("❌ Query failed:", result.error.message);
      process.exit(1);
    }
    
    if (format === "json") {
      console.log(JSON.stringify(result.results, null, 2));
    } else {
      // Table format
      if (result.results.length === 0) {
        console.log("📭 No results found");
        return;
      }
      
      // Get all unique keys from results
      const allKeys = [...new Set(result.results.flatMap(row => Object.keys(row)))];
      
      // Print header
      console.log(allKeys.join(" | "));
      console.log(allKeys.map(() => "---").join(" | "));
      
      // Print rows
      result.results.forEach(row => {
        const values = allKeys.map(key => {
          const value = row[key];
          if (value === null || value === undefined) return "null";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        });
        console.log(values.join(" | "));
      });
    }
    
    if (debug && result.meta) {
      console.log(`\n⏱️  Executed in ${result.meta.executionTimeMs}ms (${result.meta.rowCount} rows)`);
    }
    
  } catch (error) {
    console.error("❌ Query failed:", error);
    process.exit(1);
  }
}