// «جاهزة» — the closing section's Lottie: a happy, healthy, fit woman.
//
// Generated in-repo, like the app's exercise animations
// (apps/app/scripts/lottie-exercises), so there is no third-party licence, the
// colours are exactly the brand's, and the file is a few KB instead of whatever
// a stock export weighs.
//
// Why she is drawn this way. The audience is Saudi/Gulf women, so she wears
// modest activewear — a long-sleeve tunic over leggings and a hijab. Warmth
// comes from posture and a two-arc smile rather than a rendered face: a flat
// mark can't fall into the uncanny valley, and it survives being scaled down
// to a phone. She is celebrating her own effort, not selling anything, which
// is the promise the section's copy makes («نتيجة تشوفينها»).
//
// The loop is one breath: settle → rise onto the toes with the arms sweeping
// into a V → a small secondary bob at the top → back down. Four seconds, and
// the last pose IS the first pose, so it never seams.
//
// Usage: node scripts/fit-woman-lottie/generate.mjs
// Writes to BOTH copies of the page (apps/landing + apps/app), which must stay
// byte-identical — fitWomanAnimation.test.ts fails the build if they drift.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const landingDir = join(here, "..", "..");
const repoRoot = join(landingDir, "..", "..");

const FPS = 30;
const SECONDS = 4;
const OP = FPS * SECONDS;
const W = 448;
const H = 560;

// ── Palette ────────────────────────────────────────────────────────────────
// Tuned to read on the finale's night field (--brand-purple-950), which is why
// the garments carry the light and the deep brand purple is used only for
// contrast against them.
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
];
// Adjacent shapes have to separate by value, not by an outline — a dark
// keyline would disappear on this section's night field. So the set alternates:
// gold hijab → cream tunic → purple sleeves → skin hands, and cream tunic →
// purple leggings → gold shoes. Sleeves and leggings share a colour, which
// reads as a matching activewear set rather than a coincidence.
const GOLD = rgb("#d4a017"); // hijab, shoes, sparks
const GOLD_DEEP = rgb("#a87c10"); // the hijab's shaded side
const CREAM = rgb("#faf6ec"); // tunic
const CREAM_DIM = rgb("#ddd5c2"); // tunic hem shading
const PURPLE = rgb("#8b5ad6"); // sleeves + leggings
const PURPLE_DIM = rgb("#6b40a8"); // far limbs, one step back
const LAVENDER = rgb("#d9b0fc"); // floor shadow
const SKIN = rgb("#e8b98f");
const SKIN_DIM = rgb("#c99a72"); // far hand
const INK = rgb("#3a2547"); // eyes + smile

// ── Rig ────────────────────────────────────────────────────────────────────
// World degrees: 0° = +x (screen right), 90° = down, -90° = up. Local layer
// rotation is always (child world − parent world), which is what keeps the
// joints welded together at every interpolated frame.
const RIG = {
  torso: 118,
  neck: 6,
  headR: 34,
  upperArm: 74,
  forearm: 70,
  thigh: 96,
  shin: 92,
  // Limbs hang off the sides of the body, not out of its centre line. Without
  // these the arms start mid-chest and cut a diagonal across the tunic, and
  // the legs fuse into one column.
  shoulderHalf: 27,
  hipHalf: 14,
  hipY: 293, // resting hip height; the bob rides on top of this
  groundY: 509,
  ankleRestY: 488, // where the ankles sit when she is standing
  footHalf: 21, // half the stance width
  // The whole figure scales off the hip so she fills the square without
  // every bone length having to be re-tuned.
  scale: 106,
};

const rad = (d) => (d * Math.PI) / 180;

// ── Poses ──────────────────────────────────────────────────────────────────
// `rise` lifts the whole figure (the bounce); `heel` lifts the feet off the
// floor so the rise reads as her pushing up rather than the camera panning.
// Angles are world-space; Near is the viewer's left arm/leg, Far the right, and
// both are given explicitly so the front view stays symmetric.
const POSES = [
  // Rest. Arms hang beside her, weight even.
  {
    at: 0, rise: 0, heel: 0, sway: 0,
    angles: {
      torso: -90,
      upperArmNear: 96, forearmNear: 93,
      upperArmFar: 84, forearmFar: 87,
    },
  },
  // Load. Knees soften and the arms swing back a little — nobody springs
  // upward without gathering first, and the dip is what makes the rise read.
  {
    at: 0.14, rise: -8, heel: 0, sway: 1,
    angles: {
      torso: -87,
      upperArmNear: 108, forearmNear: 118,
      upperArmFar: 72, forearmFar: 62,
    },
  },
  // Sweep. Elbows lead and the forearms trail behind them, so the arms bend
  // through the middle of the arc instead of passing through a rigid T.
  {
    at: 0.28, rise: 6, heel: 4, sway: 0,
    angles: {
      torso: -90,
      upperArmNear: 175, forearmNear: 150,
      upperArmFar: 5, forearmFar: 30,
    },
  },
  // Peak. Open arms rather than a narrow V: it reads as welcome instead of
  // sport, and it keeps her hands inside the frame.
  {
    at: 0.42, rise: 14, heel: 14, sway: -1,
    angles: {
      torso: -91,
      upperArmNear: -146, forearmNear: -154,
      upperArmFar: -34, forearmFar: -26,
    },
  },
  // The body settles a beat after the arms arrive.
  {
    at: 0.56, rise: 9, heel: 9, sway: 1,
    angles: {
      torso: -89,
      upperArmNear: -140, forearmNear: -146,
      upperArmFar: -40, forearmFar: -34,
    },
  },
  {
    at: 0.7, rise: 12, heel: 12, sway: -0.5,
    angles: {
      torso: -90.5,
      upperArmNear: -144, forearmNear: -151,
      upperArmFar: -36, forearmFar: -29,
    },
  },
  // Coming down, swinging a touch past rest before settling back onto it.
  {
    at: 0.86, rise: 2, heel: 2, sway: 1,
    angles: {
      torso: -89,
      upperArmNear: 120, forearmNear: 112,
      upperArmFar: 60, forearmFar: 68,
    },
  },
  // Closes exactly on the opening pose — the loop has no seam.
  {
    at: 1, rise: 0, heel: 0, sway: 0,
    angles: {
      torso: -90,
      upperArmNear: 96, forearmNear: 93,
      upperArmFar: 84, forearmFar: 87,
    },
  },
];

// ── Leg IK ─────────────────────────────────────────────────────────────────
// The legs are SOLVED, not posed. Hand-authored knee angles make the dip look
// like the camera sank rather than like she bent her knees — her feet slide
// through the floor. Instead each pose says where the hip is and where the feet
// are, and the knee angle is whatever connects them. `heel` lifts the ankle as
// she comes onto the balls of her feet, which is why the peak comes out with
// straight legs (hip and ankle rise together) while the load comes out bent.
const deg = (r) => (r * 180) / Math.PI;

/** Two-link solve; `sign` picks which way the knee breaks. */
function ik2(origin, target, L1, L2, sign) {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
  const base = deg(Math.atan2(dy, dx));
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const a1 = base + sign * deg(Math.acos(Math.max(-1, Math.min(1, cosA))));
  const knee = [
    origin[0] + L1 * Math.cos(rad(a1)),
    origin[1] + L1 * Math.sin(rad(a1)),
  ];
  return { a1, a2: deg(Math.atan2(target[1] - knee[1], target[0] - knee[0])) };
}

for (const p of POSES) {
  const S = RIG.scale / 100;
  const hipY = RIG.hipY - p.rise;
  for (const [side, dir] of [["Near", -1], ["Far", 1]]) {
    const hip = [W / 2 + p.sway + dir * RIG.hipHalf * S, hipY];
    const ankle = [W / 2 + dir * RIG.footHalf, RIG.ankleRestY - p.heel];
    // Knees break outward, away from the centre line.
    const { a1, a2 } = ik2(hip, ankle, RIG.thigh * S, RIG.shin * S, -dir);
    p.angles[`thigh${side}`] = a1;
    p.angles[`shin${side}`] = a2;
  }
}

const TIMES = POSES.map((p) => p.at);

// ── Lottie helpers ─────────────────────────────────────────────────────────
const EASE = { i: { x: [0.42], y: [1] }, o: { x: [0.35], y: [0] } };

/** Keyframes from one value per pose; collapses to a static prop if constant. */
function anim(values, ease = EASE) {
  const first = JSON.stringify(values[0]);
  if (values.every((v) => JSON.stringify(v) === first)) {
    return { a: 0, k: values[0] };
  }
  return {
    a: 1,
    k: values.map((v, i) => {
      const t = Math.round(TIMES[i] * OP);
      const s = Array.isArray(v) ? v : [v];
      return i === values.length - 1 ? { t, s } : { t, s, ...ease };
    }),
  };
}

/** Explicit-timing keyframes, for the sparks that don't follow the pose list. */
function animAt(pairs, ease = EASE) {
  return {
    a: 1,
    k: pairs.map(([t, v], i) => {
      const s = Array.isArray(v) ? v : [v];
      return i === pairs.length - 1
        ? { t: Math.round(t * OP), s }
        : { t: Math.round(t * OP), s, ...ease };
    }),
  };
}

const fixed = (k) => ({ a: 0, k });

/** Never let interpolation take the long way around the circle. */
function unwrap(seq) {
  const out = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    let v = seq[i];
    while (v - out[i - 1] > 180) v -= 360;
    while (v - out[i - 1] < -180) v += 360;
    out.push(v);
  }
  return out;
}

const stroke = (c, w, o = 100) => ({
  ty: "st", c: fixed(c), o: fixed(o), w: fixed(w), lc: 2, lj: 2, bm: 0,
});
const fill = (c, o = 100) => ({ ty: "fl", c: fixed(c), o: fixed(o), bm: 0 });
const ellipse = (w, h, p = [0, 0]) => ({ ty: "el", d: 1, p: fixed(p), s: fixed([w, h]) });
const rect = (w, h, r, p = [0, 0]) => ({
  ty: "rc", d: 1, p: fixed(p), s: fixed([w, h]), r: fixed(r),
});
const line = (a, b) => ({
  ty: "sh", d: 1,
  ks: fixed({ c: false, i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [a, b] }),
});

/** Closed polygon; `t` gives per-vertex bezier handles for soft garment seams. */
const poly = (v, t = null, closed = true) => ({
  ty: "sh", d: 1,
  ks: fixed({
    c: closed,
    i: t ? t.map(([x, y]) => [-x, -y]) : v.map(() => [0, 0]),
    o: t ? t.map(([x, y]) => [x, y]) : v.map(() => [0, 0]),
    v,
  }),
});

const trIdentity = () => ({
  ty: "tr", p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]),
  r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0),
});
const group = (nm, items) => ({ ty: "gr", nm, np: items.length + 1, it: [...items, trIdentity()] });

let nextInd = 1;
function layer(nm, parent) {
  return {
    ddd: 0, ind: nextInd++, ty: 4, nm, sr: 1,
    ...(parent ? { parent } : {}),
    ks: {
      o: fixed(100), r: fixed(0), p: fixed([0, 0, 0]),
      a: fixed([0, 0, 0]), s: fixed([100, 100, 100]),
    },
    ao: 0, shapes: [], ip: 0, op: OP, st: 0, bm: 0,
  };
}

// ── Build ──────────────────────────────────────────────────────────────────
const world = (pose, key) => (key === "root" ? 0 : pose.angles[key]);
const localRot = (key, parent) =>
  anim(unwrap(POSES.map((p) => world(p, key) - world(p, parent))));

// Root null at the hip. `rise` is the bounce; `sway` a hair of side-to-side so
// the figure never looks pinned to a rail.
const rootInd = nextInd;
const root = {
  ddd: 0, ind: nextInd++, ty: 3, nm: "root", sr: 1,
  ks: {
    o: fixed(0), r: fixed(0),
    p: anim(POSES.map((p) => [W / 2 + p.sway, RIG.hipY - p.rise, 0])),
    a: fixed([0, 0, 0]), s: fixed([RIG.scale, RIG.scale, 100]),
  },
  ao: 0, ip: 0, op: OP, st: 0, bm: 0,
};

/**
 * One limb chain: capsule strokes welded by parenting. `attach` runs along the
 * parent's own axis, `side` steps perpendicular to it — which is how a
 * shoulder or a hip sits out from the spine.
 */
function limb({ nm, parent, attach, side = 0, len, w, color, key, parentKey }) {
  const l = layer(nm, parent);
  l.ks.p = fixed([attach, side, 0]);
  l.ks.r = localRot(key, parentKey);
  l.shapes = [group(nm, [line([0, 0], [len, 0]), stroke(color, w)])];
  return l;
}

// Torso: a fitted athletic tunic drawn in the torso's own frame (+x runs
// hip → shoulder), so it leans with her instead of sliding. It nips in at the
// waist and flares back out over the hip — the silhouette is what says
// "training top" rather than "rectangle".
const torso = layer("torso", rootInd);
const torsoInd = torso.ind;
torso.ks.r = localRot("torso", "root");
torso.shapes = [
  // Hem band, a shade darker so the tunic reads as cloth with a finished edge.
  group("hem", [
    poly(
      [[-18, -39], [-33, -38], [-33, 38], [-18, 39]],
      [[-6, 0], [0, 0], [0, 0], [6, 0]],
    ),
    fill(CREAM_DIM),
  ]),
  group("tunic", [
    poly(
      [[112, -32], [80, -38], [32, -31], [-33, -38],
       [-33, 38], [32, 31], [80, 38], [112, 32]],
      [[0, 0], [-16, -1], [-20, -4], [0, 0],
       [0, 0], [20, 4], [16, 1], [0, 0]],
    ),
    fill(CREAM),
  ]),
];

// Arms. Purple sleeves against the cream tunic is what keeps them readable
// when they hang across the body; both sides stay bright because this is a
// front view, where a dimmed arm reads as an injury rather than as depth.
// In the torso's frame +y points to the viewer's right, so Near (the arm that
// hangs on the viewer's left) attaches at a negative offset.
const armNear = limb({
  nm: "upperArmNear", parent: torsoInd, attach: RIG.torso - 8, side: -RIG.shoulderHalf,
  len: RIG.upperArm, w: 24, color: PURPLE, key: "upperArmNear", parentKey: "torso",
});
const foreNear = limb({
  nm: "forearmNear", parent: armNear.ind, attach: RIG.upperArm, len: RIG.forearm,
  w: 21, color: PURPLE, key: "forearmNear", parentKey: "upperArmNear",
});
const armFar = limb({
  nm: "upperArmFar", parent: torsoInd, attach: RIG.torso - 8, side: RIG.shoulderHalf,
  len: RIG.upperArm, w: 24, color: PURPLE_DIM, key: "upperArmFar", parentKey: "torso",
});
const foreFar = limb({
  nm: "forearmFar", parent: armFar.ind, attach: RIG.upperArm, len: RIG.forearm,
  w: 21, color: PURPLE_DIM, key: "forearmFar", parentKey: "upperArmFar",
});

/** Open hand at the end of a forearm. */
function hand(parent, dim) {
  const l = layer(dim ? "handFar" : "handNear", parent);
  l.ks.p = fixed([RIG.forearm + 4, 0, 0]);
  l.shapes = [group("hand", [ellipse(21, 21), fill(dim ? SKIN_DIM : SKIN)])];
  return l;
}
const handNear = hand(foreNear.ind, false);
const handFar = hand(foreFar.ind, true);

// Legs. The root null is world-aligned, so here `side` is a plain horizontal
// step: the two legs leave the hip apart and stay apart.
const thighNear = limb({
  nm: "thighNear", parent: rootInd, attach: -RIG.hipHalf, len: RIG.thigh,
  w: 30, color: PURPLE, key: "thighNear", parentKey: "root",
});
const shinNear = limb({
  nm: "shinNear", parent: thighNear.ind, attach: RIG.thigh, len: RIG.shin,
  w: 26, color: PURPLE, key: "shinNear", parentKey: "thighNear",
});
const thighFar = limb({
  nm: "thighFar", parent: rootInd, attach: RIG.hipHalf, len: RIG.thigh,
  w: 30, color: PURPLE_DIM, key: "thighFar", parentKey: "root",
});
const shinFar = limb({
  nm: "shinFar", parent: thighFar.ind, attach: RIG.thigh, len: RIG.shin,
  w: 26, color: PURPLE_DIM, key: "shinFar", parentKey: "thighFar",
});

/**
 * Trainer at the ankle. It counter-rotates out of the shin's frame so it stays
 * level with the floor, then rolls outward as she comes onto the balls of her
 * feet — near and far tip opposite ways, which is what a real push-off looks
 * like from the front.
 */
function shoe(parent, key, dim, tipSign) {
  const l = layer(dim ? "shoeFar" : "shoeNear", parent);
  l.ks.p = fixed([RIG.shin, 0, 0]);
  // World angle 0 = level; `heel` rolls it. Local = world − parent world.
  l.ks.r = anim(
    unwrap(POSES.map((p) => tipSign * p.heel * 0.8 - world(p, key))),
  );
  l.shapes = [
    group("shoe", [
      rect(44, 18, 8, [3, 7]),
      fill(dim ? GOLD_DEEP : GOLD),
    ]),
  ];
  return l;
}
const shoeNear = shoe(shinNear.ind, "shinNear", false, -1);
const shoeFar = shoe(shinFar.ind, "shinFar", true, 1);

// Head. Rotating the layer +90 against the torso puts its local axes back in
// screen orientation, so the hijab and the face can be drawn the way they read
// rather than sideways along the spine.
const head = layer("head", torsoInd);
head.ks.p = fixed([RIG.torso + RIG.neck + RIG.headR, 0, 0]);
// Local = wantedWorld − parentWorld. We want the head upright (world 0), and
// the parent torso sits at ≈−90, so this lands on ≈+90 — without it the whole
// head is drawn lying on its side along the spine.
head.ks.r = anim(unwrap(POSES.map((p) => -p.angles.torso)));
/** Smooth 3-point arc — the only curve the face needs. */
const arc = (a, b, c, bow) => ({
  ty: "sh", d: 1,
  ks: fixed({
    c: false,
    i: [[0, 0], [-bow, 0], [-(c[0] - b[0]) * 0.5, 0]],
    o: [[(b[0] - a[0]) * 0.5, 0], [bow, 0], [0, 0]],
    v: [a, b, c],
  }),
});

head.shapes = [
  // Drawn top-down: the face sits on the hijab, the hijab on the drape.
  group("smile", [arc([-8, 5], [0, 11], [8, 5], 4), stroke(INK, 3, 90)]),
  // Closed, upward-curving eyes — the whole expression, and the one mark that
  // can't fall into the uncanny valley the way a rendered eye would.
  group("eyeL", [arc([-19, 0], [-12, -5], [-5, 0], 3.5), stroke(INK, 3.2, 92)]),
  group("eyeR", [arc([5, 0], [12, -5], [19, 0], 3.5), stroke(INK, 3.2, 92)]),
  group("face", [ellipse(46, 54, [0, -1]), fill(SKIN)]),
  // Hijab: crown over the forehead, down past the jaw, closing under the chin.
  group("hijab", [
    poly(
      [[0, -34], [31, -18], [30, 18], [17, 36], [0, 41], [-17, 36], [-30, 18], [-31, -18]],
      [[17, 0], [3, 12], [1, 12], [-9, 3], [-10, 0], [-2, 5], [-2, -11], [-3, -12]],
    ),
    fill(GOLD),
  ]),
  // The drape falling onto the shoulders, behind the hijab and the tunic.
  group("drape", [
    poly(
      [[-28, -8], [-41, 26], [-36, 60], [36, 60], [41, 26], [28, -8]],
      [[0, 0], [-2, 16], [0, 0], [0, 0], [2, 16], [0, 0]],
    ),
    fill(GOLD_DEEP, 88),
  ]),
];

// Floor: a soft ellipse that tightens and fades as she leaves the ground, which
// is what makes the rise read as height rather than scale.
const shadow = layer("shadow");
shadow.ks.p = fixed([W / 2, RIG.groundY, 0]);
shadow.ks.s = anim(POSES.map((p) => [100 - p.rise * 1.5, 100 - p.rise * 1.5, 100]));
shadow.ks.o = anim(POSES.map((p) => 42 - p.rise * 0.9));
shadow.shapes = [group("shadow", [ellipse(152, 28), fill(LAVENDER)])];

// No halo, no glow disc behind her: a decorative blob is exactly the pattern
// the brief bans, and on a night field a flat one reads as a plate. Depth
// comes from the shadow and the sparks instead.

/** Four-point spark; pops only while her arms are up. */
function spark(x, y, size, at) {
  const l = layer(`spark-${Math.round(x)}-${Math.round(y)}`);
  l.ks.p = fixed([x, y, 0]);
  l.ks.s = animAt([
    [at, [0, 0, 100]],
    [at + 0.07, [110, 110, 100]],
    [at + 0.14, [100, 100, 100]],
    [at + 0.3, [0, 0, 100]],
  ]);
  l.ks.o = animAt([
    [at, 0],
    [at + 0.06, 100],
    [at + 0.22, 100],
    [at + 0.3, 0],
  ]);
  l.ks.r = fixed(12);
  const s = size;
  l.shapes = [
    group("spark", [
      poly(
        [[0, -s], [s * 0.28, -s * 0.28], [s, 0], [s * 0.28, s * 0.28],
         [0, s], [-s * 0.28, s * 0.28], [-s, 0], [-s * 0.28, -s * 0.28]],
      ),
      fill(GOLD),
    ]),
  ];
  return l;
}
const sparks = [
  spark(72, 110, 17, 0.36),
  spark(376, 92, 20, 0.4),
  spark(36, 212, 12, 0.44),
  spark(408, 200, 14, 0.48),
  spark(224, 44, 10, 0.46),
];

// Stacking: first layer in the array paints on top.
const layers = [
  ...sparks,
  head,
  handNear, foreNear, armNear,
  torso,
  shoeNear, shinNear, thighNear,
  handFar, foreFar, armFar,
  shoeFar, shinFar, thighFar,
  shadow,
  root,
];

const animation = {
  v: "5.7.4", fr: FPS, ip: 0, op: OP, w: W, h: H,
  nm: "fit-woman", ddd: 0, assets: [], layers,
};

// `--report` prints where the figure actually lands, per pose, in composition
// units. Framing this by screenshot is guesswork; this is the arithmetic the
// screenshots were only approximating.
if (process.argv.includes("--report")) {
  const S = RIG.scale / 100;
  const at = (o, a, len) => [o[0] + len * S * Math.cos(rad(a)), o[1] + len * S * Math.sin(rad(a))];
  const r1 = (n) => Math.round(n);
  console.log(`comp ${W}×${H}  ground ${RIG.groundY}`);
  for (const p of POSES) {
    const hip = [W / 2 + p.sway, RIG.hipY - p.rise];
    const shoulder = at(hip, p.angles.torso, RIG.torso);
    const headTop = at(hip, p.angles.torso, RIG.torso + RIG.neck + 2 * RIG.headR);
    const hand = (side) => {
      const sh = [
        shoulder[0] + (side === "Near" ? -1 : 1) * RIG.shoulderHalf * S,
        shoulder[1] - RIG.torso * S * 0 - 8 * S * Math.sin(rad(p.angles.torso)),
      ];
      const el = at(sh, p.angles[`upperArm${side}`], RIG.upperArm);
      return at(el, p.angles[`forearm${side}`], RIG.forearm);
    };
    const ankle = (side) => {
      const h = [hip[0] + (side === "Near" ? -1 : 1) * RIG.hipHalf * S, hip[1]];
      return at(at(h, p.angles[`thigh${side}`], RIG.thigh), p.angles[`shin${side}`], RIG.shin);
    };
    const hN = hand("Near"), hF = hand("Far");
    const aN = ankle("Near"), aF = ankle("Far");
    const warn = [];
    if (headTop[1] - RIG.headR * S < 8) warn.push("HEAD CLIPPED");
    if (Math.min(hN[1], hF[1]) - 12 * S < 8) warn.push("HANDS CLIPPED");
    if (Math.max(hN[0], hF[0]) + 12 * S > W - 8 || Math.min(hN[0], hF[0]) - 12 * S < 8) warn.push("HANDS OFF-SIDE");
    if (Math.max(aN[1], aF[1]) + 16 * S > H - 8) warn.push("FEET CLIPPED");
    console.log(
      `t=${String(p.at).padEnd(5)} headTop=${r1(headTop[1] - RIG.headR * S)}` +
        ` hands=(${r1(hN[0])},${r1(hN[1])})/(${r1(hF[0])},${r1(hF[1])})` +
        ` ankleY=${r1(aN[1])} footBottom=${r1(Math.max(aN[1], aF[1]) + 16 * S)}` +
        (warn.length ? `  ⚠ ${warn.join(", ")}` : ""),
    );
  }
}

const json = JSON.stringify(animation);
for (const target of [
  join(landingDir, "public", "lottie", "fit-woman.json"),
  join(repoRoot, "apps", "app", "public", "lottie", "fit-woman.json"),
]) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json);
  console.log(`${(json.length / 1024).toFixed(1)} KB → ${target}`);
}
