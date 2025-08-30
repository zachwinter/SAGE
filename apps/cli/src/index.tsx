#!/usr/bin/env node

import { analyze } from "./commands/analyze.js";
import { ask } from "./commands/ask.js";
import { help } from "./commands/help.js";
import { ingest } from "./commands/ingest.js";
import { query } from "./commands/query.js";
import { version } from "./commands/version.js";
import { createDirectoryManager } from "@sage/utils";

(async () => {
  const args = process.argv.slice(2);
  // Get the directory manager for this environment
  const directoryManager = createDirectoryManager();

  if (args.includes("--help") || args.includes("-h") || !args.length) {
    help();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    version();
    process.exit(0);
  }

  if (args[0] === "analyze") {
    const debug = args.includes("--debug");
    const format = args.includes("--json") ? "json" : "summary";
    await analyze({ debug, format });
    process.exit(0);
  }

  if (args[0] === "ingest") {
    const debug = args.includes("--debug");
    await ingest({ debug });
    process.exit(0);
  }

  if (args[0] === "query") {
    if (args.length < 2) {
      console.error("❌ Please provide a Cypher query");
      console.error("📖 Usage: sage query \"MATCH (n) RETURN n LIMIT 10\"");
      process.exit(1);
    }
    
    const cypherQuery = args[1];
    const debug = args.includes("--debug");
    const format = args.includes("--json") ? "json" : "table";
    const dbFlag = args.indexOf("--database");
    const database = dbFlag !== -1 && args[dbFlag + 1] ? args[dbFlag + 1] : undefined;
    
    await query(cypherQuery, { debug, format, database });
    process.exit(0);
  }

  if (args[0] === "ask") {
    await ask(directoryManager);
  }
})();
