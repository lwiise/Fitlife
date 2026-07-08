// Generate the exercise Lottie JSON files into public/lottie/exercises/.
// Usage: node scripts/lottie-exercises/generate.mjs [--debug]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLottie, fkDebug } from "./rig.mjs";
import { ALL } from "./poses/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "lottie", "exercises");
const debug = process.argv.includes("--debug");

await mkdir(outDir, { recursive: true });
for (const def of ALL) {
  const lottie = buildLottie(def);
  const json = JSON.stringify(lottie);
  const file = join(outDir, `${def.id}.json`);
  await writeFile(file, json);
  console.log(`${def.id}.json  ${(json.length / 1024).toFixed(1)} KB`);
  if (debug) {
    for (const pose of def.poses) {
      console.log(`  at=${pose.at}`, fkDebug(pose, def.farPeek));
    }
  }
}
