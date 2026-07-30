// Single-frame inspector: renders the animation at one phase, full size, with
// an optional 64px grid so geometry can be measured rather than guessed.
// Usage: node scripts/fit-woman-lottie/frame.mjs [phase] [outDir] [--grid]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "..");
const phase = Number(process.argv[2] ?? 0.38);
const outDir = process.argv[3] ?? join(here, "qa-out");
const grid = process.argv.includes("--grid");
const BG = process.env.QA_BG ?? "#1a0f2b";
const SIZE_W = 448;
const SIZE_H = 560;

const player = await readFile(
  join(appDir, "node_modules", "lottie-web", "build", "player", "lottie_light.min.js"),
  "utf8",
);
const data = await readFile(join(appDir, "public", "lottie", "fit-woman.json"), "utf8");

const gridCss = grid
  ? `#c::after{content:"";position:absolute;inset:0;pointer-events:none;
     background-image:linear-gradient(to right,#ffffff22 1px,transparent 1px),
                      linear-gradient(to bottom,#ffffff22 1px,transparent 1px);
     background-size:${SIZE_W / 7}px ${SIZE_H / 10}px;}`
  : "";

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:${BG}}
  #c{width:${SIZE_W}px;height:${SIZE_H}px;position:relative}
  #c svg{position:absolute;inset:0}
  ${gridCss}
</style></head><body><div id="c"></div>
<script>${player}<\/script>
<script>
  const a = lottie.loadAnimation({
    container: document.getElementById("c"), renderer: "svg",
    loop: false, autoplay: false, animationData: ${data},
  });
  a.goToAndStop(Math.round(${phase} * (a.totalFrames - 1)), true);
</script></body></html>`;

await mkdir(outDir, { recursive: true });
const page = join(outDir, "frame.html");
await writeFile(page, html);
const shot = join(outDir, `frame-${Math.round(phase * 100)}.png`);
execFileSync(process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--window-size=${SIZE_W},${SIZE_H}`, "--virtual-time-budget=4000",
  `--screenshot=${shot}`, `file://${page}`,
]);
console.log(shot);
