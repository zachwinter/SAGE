#!/usr/bin/env node

import { ask } from "./commands/ask.js";
import { help } from "./commands/help.js";
import { ingest } from "./commands/ingest.js";
import { version } from "./commands/version.js";

(async () => {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || !args.length) {
    help();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    version();
    process.exit(0);
  }

  if (args[0] === "ingest") {
    await ingest();
    process.exit(0);
  }

  if (args[0] === "ask") {
    await ask();
  }
})();
