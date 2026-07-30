// Visual QA: render the generated animation frozen at several loop phases into
// one sheet and screenshot it with the sandbox Chromium, so the figure can be
// checked pose by pose without a browser. Mirrors
// apps/app/scripts/lottie-exercises/qa.mjs.
//
// Usage: node scripts/fit-woman-lottie/qa.mjs [outDir]
//        QA_BG=#ffffff node ...   (default is the finale's night field)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "..");
const outDir = process.argv[2] ?? join(here, "qa-out");
const PHASES = [0, 0.08, 0.16, 0.26, 0.38, 0.46, 0.52, 0.6, 0.68, 0.78, 0.86, 0.94];
const BG = process.env.QA_BG ?? "#1a0f2b";
const CELL = 208;
const CELL_H = 260; // the comp is 4:5, so the QA cells are too
const COLS = 6;

const player = await readFile(
  join(appDir, "node_modules", "lottie-web", "build", "player", "lottie_light.min.js"),
  "utf8",
);
const data = await readFile(join(appDir, "public", "lottie", "fit-woman.json"), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:${BG}; font-family:sans-serif; display:flex; flex-wrap:wrap; width:${CELL * COLS}px; }
  .cell { width:${CELL}px; height:${CELL_H}px; position:relative; }
  .cell i { position:absolute; top:4px; left:8px; font-size:11px; color:#9d8ab5; z-index:2; font-style:normal; }
  .cell svg { position:absolute; inset:0; }
</style></head><body>
${PHASES.map((p) => `<div class="cell" data-phase="${p}"><i>${Math.round(p * 100)}%</i></div>`).join("")}
<script>${player}<\/script>
<script>
  const DATA = ${data};
  document.querySelectorAll(".cell").forEach((el) => {
    const anim = lottie.loadAnimation({
      container: el, renderer: "svg", loop: false, autoplay: false,
      animationData: JSON.parse(JSON.stringify(DATA)),
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
  `--window-size=${CELL * COLS},${CELL_H * Math.ceil(PHASES.length / COLS) + 24}`,
  "--virtual-time-budget=4000",
  `--screenshot=${shot}`,
  `file://${page}`,
]);
console.log(`QA sheet: ${shot}`);
