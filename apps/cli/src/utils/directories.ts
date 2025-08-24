import path from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";
import { existsSync } from "fs";

const home = homedir();
const sage = path.join(home, ".sage");
const threads = path.join(sage, "threads");
const config = path.join(sage, "config.json");

if (!existsSync(sage)) mkdirSync(sage);
if (!existsSync(threads)) mkdirSync(threads);

export { sage, config, threads };
