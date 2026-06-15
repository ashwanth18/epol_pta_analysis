import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "data/inventory.json",
  "data/gap-analysis.json",
  "data/knowledge-graph.json",
  "data/commercial.json",
  "data/pdm.json",
  "data/certificates.json",
  "data/alarms-insights.json",
  "data/throughput.json",
  "data/weighments.json",
  "data/process-flow.json",
];

const missing = required.filter((rel) => !existsSync(join(root, rel)));

if (missing.length === 0) {
  process.exit(0);
}

console.log("Missing dashboard data:");
for (const file of missing) console.log(`  - ${file}`);
console.log("Running export pipeline…\n");

execSync("python3 scripts/export.py", { cwd: root, stdio: "inherit" });
