// Visual QA: render every generated animation frozen at several loop phases
// into one HTML grid, screenshot it with the sandbox Chromium, and eyeball
// the PNG. Usage: node scripts/lottie-exercises/qa.mjs [outDir]
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "..");
const jsonDir = join(appDir, "public", "lottie", "exercises");
const outDir = process.argv[2] ?? join(here, "qa-out");
const PHASES = [0, 0.2, 0.42, 0.54, 0.75, 0.92];

const player = await readFile(
  join(appDir, "node_modules", "lottie-web", "build", "player", "lottie_light.min.js"),
  "utf8",
);
// Optional 2nd arg: comma-separated ids to render (defaults to everything).
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const files = (await readdir(jsonDir))
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !only || only.has(f.replace(/\.json$/, "")))
  .sort();
const anims = await Promise.all(
  files.map(async (f) => ({ id: f.replace(/\.json$/, ""), data: await readFile(join(jsonDir, f), "utf8") })),
);

const cells = anims
  .map(
    (a) => `
  <div class="row">
    <span class="label">${a.id}</span>
    ${PHASES.map((p) => `<div class="cell" data-id="${a.id}" data-phase="${p}"><i>${Math.round(p * 100)}%</i></div>`).join("")}
  </div>`,
  )
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #EBEFF2; font-family: sans-serif; }
  .row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
  .label { width: 90px; font-weight: bold; color: #1A1023; font-size: 14px; }
  .cell { width: 236px; height: 236px; background: #fff; border-radius: 12px; position: relative; }
  .cell i { position: absolute; top: 4px; left: 8px; font-size: 11px; color: #999; z-index: 2; font-style: normal; }
  .cell svg { position: absolute; inset: 0; }
</style></head><body>${cells}
<script>${player}<\/script>
<script>
  const DATA = { ${anims.map((a) => `"${a.id}": ${a.data}`).join(",")} };
  document.querySelectorAll(".cell").forEach((el) => {
    const anim = lottie.loadAnimation({
      container: el, renderer: "svg", loop: false, autoplay: false,
      animationData: JSON.parse(JSON.stringify(DATA[el.dataset.id])),
    });
    anim.goToAndStop(Math.round(parseFloat(el.dataset.phase) * (anim.totalFrames - 1)), true);
  });
</script></body></html>`;

await mkdir(outDir, { recursive: true });
const page = join(outDir, "qa.html");
await writeFile(page, html);
const shot = join(outDir, "qa.png");
execFileSync(process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium", [
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  `--window-size=1580,${anims.length * 264 + 40}`,
  "--virtual-time-budget=4000",
  `--screenshot=${shot}`,
  `file://${page}`,
]);
console.log(`QA sheet: ${shot} (${anims.length} animations × ${PHASES.length} phases)`);
