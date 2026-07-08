// Parametric 2D exercise figure rig → Lottie JSON emitter.
//
// The figure is a side-view, deliberately abstract silhouette (no face, no
// gender detail — culturally right for our audience) drawn with rounded
// strokes in brand colors. Segments are real Lottie layers connected with
// layer parenting, so joints stay attached exactly at every interpolated
// frame; poses only keyframe joint rotations + the hip (root) position.
//
// Angle convention: world degrees, 0° = +x (figure faces right), 90° = down
// (Lottie's y axis grows downward, rotation is clockwise-positive), -90° = up.
// Pose definitions use world angles; locals are derived per parent chain.

export const COLORS = {
  purple: [78 / 255, 36 / 255, 144 / 255, 1], // #4E2490 body
  pink: [197 / 255, 69 / 255, 143 / 255, 1], // #C5458F working muscles
  lavender: [217 / 255, 176 / 255, 252 / 255, 1], // #D9B0FC floor/equipment
  yellow: [242 / 255, 187 / 255, 22 / 255, 1], // #F2BB16 motion cue
};

export const RIG = {
  headR: 30,
  neck: 12,
  torso: 130,
  upperArm: 80,
  forearm: 75,
  thigh: 105,
  shin: 100,
  foot: 45,
  limbW: 26,
  torsoW: 34,
  floorY: 486,
};

/**
 * Two-link IK: world angles for a limb from `origin` reaching `target`.
 * bend "back" puts the middle joint behind the origin→target line (elbows
 * tucked back in a push-up), "front" ahead of it (knees forward in a squat).
 */
export function ik2(origin, target, L1, L2, bend = "back") {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
  const base = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const A = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  const a1 = bend === "back" ? base + A : base - A;
  const rad = (a1 * Math.PI) / 180;
  const mid = [origin[0] + L1 * Math.cos(rad), origin[1] + L1 * Math.sin(rad)];
  const a2 = (Math.atan2(target[1] - mid[1], target[0] - mid[0]) * 180) / Math.PI;
  return { a1, a2 };
}

const EASE = { i: { x: [0.55], y: [1] }, o: { x: [0.45], y: [0] } };

function animated(values, times, op) {
  const first = values[0];
  if (values.every((v) => JSON.stringify(v) === JSON.stringify(first))) {
    return { a: 0, k: Array.isArray(first) ? first : first };
  }
  const k = values.map((v, idx) => {
    const t = Math.round(times[idx] * op);
    const s = Array.isArray(v) ? v : [v];
    if (idx === values.length - 1) return { t, s };
    return { t, s, i: EASE.i, o: EASE.o };
  });
  return { a: 1, k };
}

/** Unwrap so consecutive angles never jump across ±180 (shortest path). */
function unwrap(seq) {
  const out = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    let v = seq[i];
    const prev = out[i - 1];
    while (v - prev > 180) v -= 360;
    while (v - prev < -180) v += 360;
    out.push(v);
  }
  return out;
}

function strokeShape(name, length, width, color, opacity = 100) {
  return {
    ty: "gr",
    nm: name,
    np: 3,
    it: [
      {
        ty: "sh",
        d: 1,
        ks: {
          a: 0,
          k: { c: false, i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[0, 0], [length, 0]] },
        },
      },
      { ty: "st", c: { a: 0, k: color }, o: { a: 0, k: opacity }, w: { a: 0, k: width }, lc: 2, lj: 2, bm: 0 },
      trIdentity(),
    ],
  };
}

function trIdentity() {
  return {
    ty: "tr",
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
  };
}

function layerBase(ind, name, op, parent) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ...(parent ? { parent } : {}),
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [0, 0, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [],
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

// Segment chains: name → { parent chain key, attach distance along parent }.
const SEGMENTS = [
  { key: "torso", parent: "root", attach: 0, len: RIG.torso, w: RIG.torsoW },
  { key: "upperArmNear", parent: "torso", attach: RIG.torso, len: RIG.upperArm, w: RIG.limbW },
  { key: "forearmNear", parent: "upperArmNear", attach: RIG.upperArm, len: RIG.forearm, w: RIG.limbW },
  { key: "upperArmFar", parent: "torso", attach: RIG.torso, len: RIG.upperArm, w: RIG.limbW, far: true },
  { key: "forearmFar", parent: "upperArmFar", attach: RIG.upperArm, len: RIG.forearm, w: RIG.limbW, far: true },
  { key: "thighNear", parent: "root", attach: 0, len: RIG.thigh, w: RIG.limbW },
  { key: "shinNear", parent: "thighNear", attach: RIG.thigh, len: RIG.shin, w: RIG.limbW },
  { key: "footNear", parent: "shinNear", attach: RIG.shin, len: RIG.foot, w: RIG.limbW },
  { key: "thighFar", parent: "root", attach: 0, len: RIG.thigh, w: RIG.limbW, far: true },
  { key: "shinFar", parent: "thighFar", attach: RIG.thigh, len: RIG.shin, w: RIG.limbW, far: true },
  { key: "footFar", parent: "shinFar", attach: RIG.shin, len: RIG.foot, w: RIG.limbW, far: true },
];

/**
 * Fill missing far-side angles from the near side plus a small "peek" offset
 * so the far limb reads behind the body instead of hiding exactly underneath.
 */
function resolveAngles(pose, farPeek) {
  const a = { ...pose.angles };
  const armPeek = farPeek?.arm ?? 9;
  const legPeek = farPeek?.leg ?? 7;
  a.upperArmFar ??= a.upperArmNear + armPeek;
  a.forearmFar ??= a.forearmNear + armPeek;
  a.thighFar ??= a.thighNear + legPeek;
  a.shinFar ??= a.shinNear + legPeek;
  a.footFar ??= a.footNear;
  return a;
}

/** Forward kinematics: world positions of key joints for a resolved pose (debug/QA). */
export function fkDebug(pose, farPeek) {
  const a = resolveAngles(pose, farPeek);
  const rad = (d) => (d * Math.PI) / 180;
  const from = (p, deg, len) => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];
  const hip = pose.hip;
  const shoulder = from(hip, a.torso, RIG.torso);
  const elbow = from(shoulder, a.upperArmNear, RIG.upperArm);
  const wrist = from(elbow, a.forearmNear, RIG.forearm);
  const knee = from(hip, a.thighNear, RIG.thigh);
  const ankle = from(knee, a.shinNear, RIG.shin);
  const toe = from(ankle, a.footNear, RIG.foot);
  const round = (p) => p.map((v) => Math.round(v));
  return { hip: round(hip), shoulder: round(shoulder), wrist: round(wrist), knee: round(knee), ankle: round(ankle), toe: round(toe) };
}

/**
 * Build a full Lottie animation for one exercise definition:
 * { id, seconds, poses: [{at, hip:[x,y], angles:{...world degrees}}],
 *   highlight: [segment keys] (pink), coreBand?: bool,
 *   arrow?: { at:[x,y], rise, window:[a,b] }, farPeek?: {arm, leg} }
 */
export function buildLottie(def) {
  const fps = 30;
  const op = Math.round(def.seconds * fps);
  const poses = def.poses.map((p) => ({ ...p, angles: resolveAngles(p, def.farPeek) }));
  const times = poses.map((p) => p.at);
  const layers = [];
  const inds = {};
  let nextInd = 1;

  // Root null at the hip.
  const rootInd = nextInd++;
  inds.root = rootInd;
  layers.push({
    ddd: 0,
    ind: rootInd,
    ty: 3,
    nm: "root",
    sr: 1,
    ks: {
      o: { a: 0, k: 0 },
      r: { a: 0, k: 0 },
      p: animated(poses.map((p) => [p.hip[0], p.hip[1], 0]), times, op),
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  });

  // World angle lookup per pose, per segment key ("root" = 0).
  const worldOf = (poseAngles, key) => (key === "root" ? 0 : poseAngles[key]);

  const bodyLayers = [];
  for (const seg of SEGMENTS) {
    const ind = nextInd++;
    inds[seg.key] = ind;
    const locals = unwrap(
      poses.map((p) => worldOf(p.angles, seg.key) - worldOf(p.angles, seg.parent)),
    );
    const isHighlight = def.highlight?.includes(seg.key);
    const color = isHighlight ? COLORS.pink : COLORS.purple;
    const layer = layerBase(ind, seg.key, op, inds[seg.parent]);
    layer.ks.r = animated(locals, times, op);
    layer.ks.p = { a: 0, k: [seg.attach, 0, 0] };
    if (seg.far) layer.ks.o = { a: 0, k: 38 };
    layer.shapes = [strokeShape(seg.key, seg.len, seg.w, color)];
    bodyLayers.push({ layer, far: !!seg.far, key: seg.key });
  }

  // Head: filled circle parented to the torso, past the neck gap. `headLift`
  // (per-pose, negative = up/back perpendicular to the torso) extends the
  // neck when the torso leans, so the head reads "looking forward" instead
  // of drooping along the torso line.
  const headInd = nextInd++;
  const head = layerBase(headInd, "head", op, inds.torso);
  head.ks.p = animated(
    poses.map((p) => [RIG.torso + RIG.neck + RIG.headR, p.angles.headLift ?? 0, 0]),
    times,
    op,
  );
  head.shapes = [
    {
      ty: "gr",
      nm: "head",
      np: 3,
      it: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [RIG.headR * 2, RIG.headR * 2] } },
        { ty: "fl", c: { a: 0, k: COLORS.purple }, o: { a: 0, k: 100 }, bm: 0 },
        trIdentity(),
      ],
    },
  ];

  // Core band: pulsing pink "belt" across the abdomen (plank-style holds).
  let coreBand = null;
  if (def.coreBand) {
    const ind = nextInd++;
    coreBand = layerBase(ind, "coreBand", op, inds.torso);
    coreBand.ks.p = { a: 0, k: [RIG.torso * 0.45, 0, 0] };
    coreBand.ks.o = {
      a: 1,
      k: [
        { t: 0, s: [55], i: EASE.i, o: EASE.o },
        { t: Math.round(op / 2), s: [95], i: EASE.i, o: EASE.o },
        { t: op, s: [55] },
      ],
    };
    coreBand.shapes = [
      {
        ty: "gr",
        nm: "band",
        np: 3,
        it: [
          { ty: "rc", d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [48, 60] }, r: { a: 0, k: 24 } },
          { ty: "fl", c: { a: 0, k: COLORS.pink }, o: { a: 0, k: 100 }, bm: 0 },
          trIdentity(),
        ],
      },
    ];
  }

  // Motion cue: small yellow up-arrow that appears during the effort phase.
  let arrow = null;
  if (def.arrow) {
    const ind = nextInd++;
    const [wa, wb] = def.arrow.window;
    const mid1 = wa + (wb - wa) * 0.3;
    const mid2 = wa + (wb - wa) * 0.75;
    arrow = layerBase(ind, "arrow", op, undefined);
    arrow.ks.p = {
      a: 1,
      k: [
        { t: Math.round(wa * op), s: [def.arrow.at[0], def.arrow.at[1], 0], i: EASE.i, o: EASE.o },
        { t: Math.round(wb * op), s: [def.arrow.at[0], def.arrow.at[1] - def.arrow.rise, 0] },
      ],
    };
    arrow.ks.o = {
      a: 1,
      k: [
        { t: 0, s: [0], i: EASE.i, o: EASE.o },
        { t: Math.round(wa * op), s: [0], i: EASE.i, o: EASE.o },
        { t: Math.round(mid1 * op), s: [90], i: EASE.i, o: EASE.o },
        { t: Math.round(mid2 * op), s: [90], i: EASE.i, o: EASE.o },
        { t: Math.round(wb * op), s: [0] },
      ],
    };
    arrow.shapes = [
      {
        ty: "gr",
        nm: "arrow",
        np: 4,
        it: [
          {
            ty: "sh",
            d: 1,
            ks: { a: 0, k: { c: false, i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[0, 22], [0, -2]] } },
          },
          { ty: "st", c: { a: 0, k: COLORS.yellow }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2, bm: 0 },
          {
            ty: "sh",
            d: 1,
            ks: {
              a: 0,
              k: { c: true, i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-10, -2], [10, -2], [0, -20]] },
            },
          },
          { ty: "fl", c: { a: 0, k: COLORS.yellow }, o: { a: 0, k: 100 }, bm: 0 },
          trIdentity(),
        ],
      },
    ];
  }

  // Floor: quiet lavender ground line.
  const floorInd = nextInd++;
  const floor = layerBase(floorInd, "floor", op, undefined);
  floor.shapes = [
    {
      ty: "gr",
      nm: "floor",
      np: 3,
      it: [
        {
          ty: "sh",
          d: 1,
          ks: { a: 0, k: { c: false, i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[36, RIG.floorY], [476, RIG.floorY]] } },
        },
        { ty: "st", c: { a: 0, k: COLORS.lavender }, o: { a: 0, k: 65 }, w: { a: 0, k: 6 }, lc: 2, lj: 2, bm: 0 },
        trIdentity(),
      ],
    },
  ];

  // Stacking (first = topmost): arrow, core band, head, near arm, torso,
  // near leg, far arm, far leg, floor. Root null renders nothing.
  const near = bodyLayers.filter((b) => !b.far);
  const farL = bodyLayers.filter((b) => b.far);
  const pick = (list, ...keys) => keys.map((k) => list.find((b) => b.key === k)?.layer).filter(Boolean);
  const ordered = [
    ...(arrow ? [arrow] : []),
    ...(coreBand ? [coreBand] : []),
    head,
    ...pick(near, "forearmNear", "upperArmNear"),
    ...pick(near, "torso"),
    ...pick(near, "footNear", "shinNear", "thighNear"),
    ...pick(farL, "forearmFar", "upperArmFar"),
    ...pick(farL, "footFar", "shinFar", "thighFar"),
    floor,
    layers[0], // root null last; position in array doesn't matter for nulls
  ];

  return {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op,
    w: 512,
    h: 512,
    nm: def.id,
    ddd: 0,
    assets: [],
    layers: ordered,
  };
}
