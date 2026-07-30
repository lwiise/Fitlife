// «ختم الصفقة» — the closing section's Lottie, generated in-repo.
//
// Why generated and not downloaded: the app already builds its exercise
// animations this way (apps/app/scripts/lottie-exercises), so there is no new
// pipeline here — and it means no third-party licence, exact brand colours,
// and a file measured in single-digit KB instead of whatever a stock export
// happens to weigh.
//
// What it shows: a فاتورة filling itself in — four ledger rows write across,
// the total rule lands, the gold total drops in, then a wax seal stamps the
// deal shut with a check drawn inside it and one ripple. Same object as the
// hero receipt, one beat later in the story: «قراركِ اليوم».
//
// Usage: node scripts/deal-seal-lottie/generate.mjs
// Writes to BOTH copies of the page (apps/landing + apps/app), which must stay
// byte-identical — dealSealAnimation.test.ts fails the build if they drift.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const landingDir = join(here, "..", "..");
const repoRoot = join(landingDir, "..", "..");

const FPS = 60;
const DURATION = 360; // 6s — long enough that the hold reads as a rest, not a pause
const W = 480;
const H = 480;

// ── Brand palette, as Lottie's 0-1 float channels ──────────────────────────
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
];
const PAPER = rgb("#faf6ec");
const PURPLE_900 = rgb("#4e2490");
const PURPLE_700 = rgb("#3d1c73");
const LAVENDER = rgb("#d9b0fc");
const GOLD = rgb("#d4a017");
const INK = rgb("#1a1023");

// ── Easing: the page's own --ease-settle, cubic-bezier(0.16, 1, 0.3, 1) ────
const SETTLE = { i: { x: [0.3], y: [1] }, o: { x: [0.16], y: [0] } };
const LINEAR = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };

/** Keyframe list from [frame, value] pairs; the last one closes the property. */
const anim = (pairs, ease = SETTLE) => ({
  a: 1,
  k: pairs.map(([t, s], idx) =>
    idx === pairs.length - 1
      ? { t, s: Array.isArray(s) ? s : [s] }
      : { t, s: Array.isArray(s) ? s : [s], ...ease },
  ),
});
const fixed = (k) => ({ a: 0, k });

// ── Shape primitives ───────────────────────────────────────────────────────
const rect = (w, h, r = 0) => ({
  ty: "rc",
  d: 1,
  s: fixed([w, h]),
  p: fixed([0, 0]),
  r: fixed(r),
});
const ellipse = (d) => ({ ty: "el", d: 1, s: fixed([d, d]), p: fixed([0, 0]) });
const fill = (c, o = 100) => ({ ty: "fl", c: fixed(c), o: fixed(o), r: 1, bm: 0 });
const stroke = (c, w, o = 100) => ({
  ty: "st",
  c: fixed(c),
  o: fixed(o),
  w: fixed(w),
  lc: 2,
  lj: 2,
  bm: 0,
});
const path = (points, closed = false) => ({
  ty: "sh",
  d: 1,
  ks: fixed({
    c: closed,
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
    v: points,
  }),
});

/**
 * Group transform. Lottie maps a point as (point − anchor) × scale + position,
 * so anchoring at a rect's own right edge is what makes a bar grow out of the
 * start side of the page (RTL) instead of out of its middle.
 */
const tr = ({ p = [0, 0], a = [0, 0], s = fixed([100, 100]), r = fixed(0), o = fixed(100) }) => ({
  ty: "tr",
  p: Array.isArray(p) ? fixed(p) : p,
  a: fixed(a),
  s,
  r,
  o,
  sk: fixed(0),
  sa: fixed(0),
});

const group = (nm, items) => ({ ty: "gr", nm, np: items.length, it: items, bm: 0, hd: false });

// ── Composition ────────────────────────────────────────────────────────────
// Paper: 272×330 centred at (240, 222) → x 104…376, y 57…387.
const PAPER_CX = 240;
const PAPER_CY = 222;
const PAPER_W = 272;
const PAPER_H = 330;
const START_X = 350; // content start edge (RTL: the right side)
const END_X = 130; // content end edge

/** A bar that writes across from the start edge, like a pen filling a line. */
function writeBar({ cx, cy, w, h, color, radius, from, to, opacity = 100 }) {
  return group(`bar-${cy}-${cx}`, [
    rect(w, h, radius ?? h / 2),
    fill(color, opacity),
    tr({
      p: [cx + w / 2, cy],
      a: [w / 2, 0],
      s: anim([
        [from, [0, 100]],
        [to, [100, 100]],
      ]),
      o: anim([
        [from, 0],
        [from + 4, 100],
      ], LINEAR),
    }),
  ]);
}

/** A mark that fades up in place — the figure a written row settles onto. */
function fadeMark({ cx, cy, w, h, color, radius, from, to, opacity = 100 }) {
  return group(`mark-${cy}-${cx}`, [
    rect(w, h, radius ?? h / 2),
    fill(color, opacity),
    tr({
      p: [cx, cy],
      o: anim([
        [from, 0],
        [to, 100],
      ]),
      s: anim([
        [from, [70, 70]],
        [to, [100, 100]],
      ]),
    }),
  ]);
}

const ROW_Y = [142, 174, 206, 238];
const ROW_W = [104, 88, 116, 96];
const ROW_START = 34; // first row begins writing
const ROW_STEP = 20; // one stagger unit between rows

const rows = ROW_Y.flatMap((y, i) => {
  const from = ROW_START + i * ROW_STEP;
  const nameW = ROW_W[i];
  return [
    // leader: the dotted run between name and figure, drawn as one faint rule
    writeBar({
      cx: END_X + 52,
      cy: y + 4,
      w: START_X - nameW - END_X - 60,
      h: 2,
      radius: 1,
      color: INK,
      opacity: 16,
      from: from + 6,
      to: from + 20,
    }),
    writeBar({
      cx: START_X - nameW,
      cy: y,
      w: nameW,
      h: 11,
      color: INK,
      opacity: 34,
      from,
      to: from + 16,
    }),
    fadeMark({
      cx: END_X + 22,
      cy: y,
      w: 44,
      h: 11,
      color: GOLD,
      opacity: 90,
      from: from + 12,
      to: from + 26,
    }),
  ];
});

// The seal, hanging off the paper's bottom start corner like the hero sticker.
const SEAL_X = 322;
const SEAL_Y = 372;
const SEAL_D = 100;
const SEAL_IN = 176;

const shapes = [
  // ── Seal, on top of everything ──
  group("seal-check", [
    path([
      [-19, 2],
      [-6, 15],
      [20, -14],
    ]),
    { ty: "tm", s: fixed(0), e: anim([[SEAL_IN + 14, 0], [SEAL_IN + 42, 100]]), o: fixed(0), m: 1 },
    stroke(INK, 9),
    tr({
      p: [SEAL_X, SEAL_Y],
      r: fixed(-14),
      o: anim([[SEAL_IN + 12, 0], [SEAL_IN + 16, 100]], LINEAR),
    }),
  ]),
  // Inset ring — what makes the disc read as a stamp pressed into the page
  // rather than a flat dot.
  group("seal-ring", [
    ellipse(SEAL_D - 16),
    stroke(INK, 2, 26),
    tr({
      p: [SEAL_X, SEAL_Y],
      o: anim([[SEAL_IN - 4, 0], [SEAL_IN + 10, 100]], LINEAR),
    }),
  ]),
  group("seal-disc", [
    ellipse(SEAL_D),
    fill(GOLD),
    tr({
      p: anim([
        [SEAL_IN - 26, [SEAL_X, SEAL_Y - 84]],
        [SEAL_IN + 8, [SEAL_X, SEAL_Y]],
      ]),
      r: anim([
        [SEAL_IN - 26, -34],
        [SEAL_IN + 14, -14],
      ]),
      s: anim([
        [SEAL_IN - 26, [78, 78]],
        [SEAL_IN + 8, [106, 106]],
        [SEAL_IN + 24, [100, 100]],
      ]),
      o: anim([[SEAL_IN - 26, 0], [SEAL_IN - 18, 100]], LINEAR),
    }),
  ]),
  // One ripple leaving the seal — the only "loud" beat, and it happens once.
  group("seal-ripple", [
    ellipse(SEAL_D),
    stroke(GOLD, 4),
    tr({
      p: [SEAL_X, SEAL_Y],
      s: anim([
        [SEAL_IN + 6, [92, 92]],
        [SEAL_IN + 70, [176, 176]],
      ]),
      o: anim([
        [SEAL_IN + 6, 0],
        [SEAL_IN + 16, 62],
        [SEAL_IN + 70, 0],
      ]),
    }),
  ]),

  // ── Total block ──
  fadeMark({ cx: END_X + 52, cy: 296, w: 104, h: 28, radius: 8, color: GOLD, from: 150, to: 176 }),
  fadeMark({ cx: START_X - 38, cy: 298, w: 76, h: 10, color: INK, opacity: 40, from: 146, to: 168 }),
  writeBar({
    cx: END_X,
    cy: 268,
    w: START_X - END_X,
    h: 2,
    radius: 1,
    color: INK,
    opacity: 26,
    from: 126,
    to: 150,
  }),

  // ── Barcode — nine bars flickering up together, the receipt's signature ──
  ...Array.from({ length: 9 }, (_, i) =>
    fadeMark({
      cx: END_X + 10 + i * 13,
      cy: 340,
      w: i % 3 === 0 ? 7 : 4,
      h: 26,
      radius: 1,
      color: INK,
      opacity: 34,
      from: 196 + i * 3,
      to: 214 + i * 3,
    }),
  ),

  // ── Ledger rows ──
  ...rows,

  // ── Header: brand mark on the start side, label on the end side ──
  writeBar({ cx: START_X - 82, cy: 96, w: 82, h: 14, color: PURPLE_900, from: 16, to: 34 }),
  fadeMark({ cx: END_X + 30, cy: 97, w: 60, h: 9, color: LAVENDER, from: 22, to: 40 }),
  writeBar({
    cx: END_X,
    cy: 122,
    w: START_X - END_X,
    h: 2,
    radius: 1,
    color: INK,
    opacity: 22,
    from: 24,
    to: 46,
  }),

  // ── Paper, then the card stacked behind it ──
  group("paper", [
    rect(PAPER_W, PAPER_H, 20),
    fill(PAPER),
    tr({
      p: [PAPER_CX, PAPER_CY],
      a: [0, 0],
      s: anim([
        [0, [92, 92]],
        [22, [100, 100]],
      ]),
      o: anim([[0, 0], [10, 100]], LINEAR),
    }),
  ]),
  group("paper-shadow", [
    rect(PAPER_W, PAPER_H, 20),
    fill(PURPLE_700, 55),
    tr({
      p: [PAPER_CX + 16, PAPER_CY + 18],
      s: anim([
        [0, [92, 92]],
        [26, [100, 100]],
      ]),
      o: anim([[0, 0], [14, 55]], LINEAR),
    }),
  ]),
];

const animation = {
  v: "5.7.4",
  fr: FPS,
  ip: 0,
  op: DURATION,
  w: W,
  h: H,
  nm: "deal-seal",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "deal-seal",
      sr: 1,
      ks: {
        // Layer opacity carries the loop: everything is already built by 310,
        // rests, then dissolves so frame 360 matches frame 0 exactly and the
        // loop has no seam.
        o: anim([
          [0, 100],
          [312, 100],
          [344, 0],
        ]),
        r: fixed(0),
        p: fixed([0, 0, 0]),
        a: fixed([0, 0, 0]),
        s: fixed([100, 100, 100]),
      },
      ao: 0,
      shapes,
      ip: 0,
      op: DURATION,
      st: 0,
      bm: 0,
    },
  ],
};

const json = JSON.stringify(animation);
const targets = [
  join(landingDir, "public", "lottie", "deal-seal.json"),
  join(repoRoot, "apps", "app", "public", "lottie", "deal-seal.json"),
];

for (const target of targets) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json);
  console.log(`${(json.length / 1024).toFixed(1)} KB → ${target}`);
}
