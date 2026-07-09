// Parametric 2D exercise figure rig → Lottie JSON emitter.
//
// The figure is a deliberately abstract silhouette (no face, no gender
// detail — culturally right for our audience) drawn with rounded strokes in
// brand colors. Segments are real Lottie layers connected with layer
// parenting, so joints stay attached exactly at every interpolated frame;
// poses only keyframe joint rotations + the hip (root) position.
//
// Angle convention: world degrees, 0° = +x (figure faces right), 90° = down
// (Lottie's y axis grows downward, rotation is clockwise-positive), -90° = up.
// Pose definitions use world angles; locals are derived per parent chain.
// Front-view poses are just symmetric angle choices (near = viewer's right
// limb, far = left) with `farOpacity` raised so both sides read equally.

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

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** World point at `len` along world angle `a` from `p`. */
export function jointFrom(p, a, len) {
  return [p[0] + len * Math.cos(rad(a)), p[1] + len * Math.sin(rad(a))];
}

/**
 * Two-link IK: world angles for a limb from `origin` reaching `target`.
 * bend "back" puts the middle joint behind the origin→target line (elbows
 * tucked back in a push-up), "front" ahead of it (knees forward in a squat).
 */
export function ik2(origin, target, L1, L2, bend = "back") {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.01);
  const base = deg(Math.atan2(dy, dx));
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const A = deg(Math.acos(Math.max(-1, Math.min(1, cosA))));
  const a1 = bend === "back" ? base + A : base - A;
  const mid = jointFrom(origin, a1, L1);
  const a2 = deg(Math.atan2(target[1] - mid[1], target[0] - mid[0]));
  return { a1, a2 };
}

/** Arm IK sugar: world angles reaching wrist `target` from `shoulder`. */
export function armIK(shoulder, target, bend = "back") {
  const { a1, a2 } = ik2(shoulder, target, RIG.upperArm, RIG.forearm, bend);
  return { upper: a1, fore: a2 };
}

/** Leg IK sugar: world angles reaching ankle `target` from `hip`. */
export function legIK(hip, target, bend = "front") {
  const { a1, a2 } = ik2(hip, target, RIG.thigh, RIG.shin, bend);
  return { thigh: a1, shin: a2 };
}

const EASES = {
  inout: { i: { x: [0.55], y: [1] }, o: { x: [0.45], y: [0] } },
  linear: { i: { x: [2 / 3], y: [2 / 3] }, o: { x: [1 / 3], y: [1 / 3] } },
};

function animated(values, times, op, ease = "inout") {
  const first = values[0];
  if (values.every((v) => JSON.stringify(v) === JSON.stringify(first))) {
    return { a: 0, k: first };
  }
  const E = EASES[ease] ?? EASES.inout;
  const k = values.map((v, idx) => {
    const t = Math.round(times[idx] * op);
    const s = Array.isArray(v) ? v : [v];
    if (idx === values.length - 1) return { t, s };
    return { t, s, i: E.i, o: E.o };
  });
  return { a: 1, k };
}

/** Path-shaped keyframes (for bands/cables whose endpoints are world FK). */
function animatedPath(paths, times, op, ease = "inout") {
  const first = JSON.stringify(paths[0]);
  if (paths.every((p) => JSON.stringify(p) === first)) {
    return { a: 0, k: paths[0] };
  }
  const E = EASES[ease] ?? EASES.inout;
  const k = paths.map((p, idx) => {
    const t = Math.round(times[idx] * op);
    if (idx === paths.length - 1) return { t, s: [p] };
    return { t, s: [p], i: E.i, o: E.o };
  });
  return { a: 1, k };
}

const line2 = (a, b) => ({
  c: false,
  i: [[0, 0], [0, 0]],
  o: [[0, 0], [0, 0]],
  v: [a, b],
});

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

function group(name, items) {
  return { ty: "gr", nm: name, np: items.length + 1, it: [...items, trIdentity()] };
}

const stroke = (color, w, opacity = 100) => ({
  ty: "st",
  c: { a: 0, k: color },
  o: { a: 0, k: opacity },
  w: { a: 0, k: w },
  lc: 2,
  lj: 2,
  bm: 0,
});
const fill = (color, opacity = 100) => ({ ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: opacity }, bm: 0 });

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

/** Forward kinematics: world joint positions for a resolved pose. */
export function fkJoints(pose, farPeek) {
  const a = resolveAngles(pose, farPeek);
  const hip = pose.hip;
  const shoulder = jointFrom(hip, a.torso, RIG.torso);
  const j = (side) => {
    const elbow = jointFrom(shoulder, a[`upperArm${side}`], RIG.upperArm);
    const wrist = jointFrom(elbow, a[`forearm${side}`], RIG.forearm);
    const knee = jointFrom(hip, a[`thigh${side}`], RIG.thigh);
    const ankle = jointFrom(knee, a[`shin${side}`], RIG.shin);
    const toe = jointFrom(ankle, a[`foot${side}`], RIG.foot);
    return { elbow, wrist, knee, ankle, toe };
  };
  return { hip, shoulder, near: j("Near"), far: j("Far") };
}

/** Rounded debug print of the key near-side joints (generator --debug). */
export function fkDebug(pose, farPeek) {
  const f = fkJoints(pose, farPeek);
  const r = (p) => p.map((v) => Math.round(v));
  return {
    hip: r(f.hip),
    shoulder: r(f.shoulder),
    wrist: r(f.near.wrist),
    knee: r(f.near.knee),
    ankle: r(f.near.ankle),
    toe: r(f.near.toe),
  };
}

function resolveBandEnd(end, joints) {
  if (end.point) return end.point;
  const map = {
    wristNear: joints.near.wrist,
    wristFar: joints.far.wrist,
    ankleNear: joints.near.ankle,
    ankleFar: joints.far.ankle,
    toeNear: joints.near.toe,
    shoulder: joints.shoulder,
    hip: joints.hip,
  };
  return map[end.joint];
}

/**
 * Build a full Lottie animation for one exercise definition:
 * {
 *   id, seconds, ease?: "inout"|"linear",
 *   poses: [{ at, hip:[x,y], angles:{ torso, upperArmNear, forearmNear,
 *     thighNear, shinNear, footNear, (Far variants optional), headLift?,
 *     torsoArch? } }],
 *   highlight?: [segment keys],           // pink strokes
 *   coreBand?: true | { at?: 0..1, size?: [w,h] },
 *   arrow?: { at:[x,y], move:[dx,dy], window:[a,b] },
 *   props?: [{ type:"dumbbell"|"plate"|"pad", parent, at?, far?, keepWorldAngle? }
 *            | { type:"band", from:{point|joint}, to:{point|joint}, w? }],
 *   furniture?: [{ kind:"rect", x,y,w,h,r? } | { kind:"line", x1,y1,x2,y2,w? }
 *                | { kind:"circle", x,y,r }],
 *   farPeek?: { arm, leg }, farOpacity?: number, floor?: boolean,
 * }
 */
export function buildLottie(def) {
  const fps = 30;
  const op = Math.round(def.seconds * fps);
  const ease = def.ease ?? "inout";
  const poses = def.poses.map((p) => ({ ...p, angles: resolveAngles(p, def.farPeek) }));
  const times = poses.map((p) => p.at);
  const jointsPerPose = poses.map((p) => fkJoints(p, def.farPeek));
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
      p: animated(poses.map((p) => [p.hip[0], p.hip[1], 0]), times, op, ease),
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  });

  const worldOf = (poseAngles, key) => (key === "root" ? 0 : poseAngles[key]);
  const farOpacity = def.farOpacity ?? 38;

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
    layer.ks.r = animated(locals, times, op, ease);
    layer.ks.p = { a: 0, k: [seg.attach, 0, 0] };
    if (seg.far) layer.ks.o = { a: 0, k: farOpacity };

    // The torso may arch (cat-cow, crunch): animate the path's bezier bow.
    if (seg.key === "torso" && poses.some((p) => (p.angles.torsoArch ?? 0) !== 0)) {
      const paths = poses.map((p) => {
        const arch = p.angles.torsoArch ?? 0;
        return {
          c: false,
          i: [[0, 0], [-seg.len * 0.35, arch]],
          o: [[seg.len * 0.35, arch], [0, 0]],
          v: [[0, 0], [seg.len, 0]],
        };
      });
      layer.shapes = [
        group(seg.key, [
          { ty: "sh", d: 1, ks: animatedPath(paths, times, op, ease) },
          stroke(color, seg.w),
        ]),
      ];
    } else {
      layer.shapes = [
        group(seg.key, [
          { ty: "sh", d: 1, ks: { a: 0, k: line2([0, 0], [seg.len, 0]) } },
          stroke(color, seg.w),
        ]),
      ];
    }
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
    ease,
  );
  head.shapes = [
    group("head", [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [RIG.headR * 2, RIG.headR * 2] } },
      fill(COLORS.purple),
    ]),
  ];

  // Core band: pulsing pink "belt" (plank-style holds, pelvic-floor work).
  let coreBand = null;
  if (def.coreBand) {
    const conf = def.coreBand === true ? {} : def.coreBand;
    const at = conf.at ?? 0.45;
    const [bw, bh] = conf.size ?? [48, 60];
    const ind = nextInd++;
    coreBand = layerBase(ind, "coreBand", op, inds.torso);
    coreBand.ks.p = { a: 0, k: [RIG.torso * at, 0, 0] };
    coreBand.ks.o = {
      a: 1,
      k: [
        { t: 0, s: [55], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(op / 2), s: [95], i: EASES.inout.i, o: EASES.inout.o },
        { t: op, s: [55] },
      ],
    };
    coreBand.shapes = [
      group("band", [
        { ty: "rc", d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [bw, bh] }, r: { a: 0, k: Math.min(bw, bh) / 2 } },
        fill(COLORS.pink),
      ]),
    ];
  }

  // Props riding the figure (dumbbells at hands, plates, machine pads).
  const propLayers = [];
  const bandLayers = [];
  for (const prop of def.props ?? []) {
    if (prop.type === "band") {
      const ind = nextInd++;
      const layer = layerBase(ind, "band", op, undefined);
      const paths = jointsPerPose.map((j) =>
        line2(resolveBandEnd(prop.from, j), resolveBandEnd(prop.to, j)),
      );
      layer.shapes = [
        group("band", [
          { ty: "sh", d: 1, ks: animatedPath(paths, times, op, ease) },
          stroke(COLORS.lavender, prop.w ?? 9, 85),
        ]),
      ];
      // `above` draws the band in front of the body (front-view moves where
      // the band crosses the chest); default sits behind the near limbs.
      layer._above = !!prop.above;
      bandLayers.push(layer);
      continue;
    }
    const sides = prop.far ? ["Near", "Far"] : ["Near"];
    for (const side of sides) {
      const parentKey = (prop.parent ?? "forearmNear").replace("Near", side);
      const seg = SEGMENTS.find((s) => s.key === parentKey);
      if (!seg) continue;
      const ind = nextInd++;
      const layer = layerBase(ind, `${prop.type}${side}`, op, inds[parentKey]);
      layer.ks.p = { a: 0, k: [prop.at ?? seg.len, 0, 0] };
      if (side === "Far") layer.ks.o = { a: 0, k: farOpacity + 15 };
      if (prop.keepWorldAngle != null) {
        const locals = unwrap(
          poses.map((p) => prop.keepWorldAngle - worldOf(p.angles, parentKey)),
        );
        layer.ks.r = animated(locals, times, op, ease);
      }
      if (prop.type === "dumbbell") {
        layer.shapes = [
          group("db", [
            { ty: "rc", d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [15, 42] }, r: { a: 0, k: 7 } },
            fill(COLORS.lavender),
          ]),
        ];
      } else if (prop.type === "plate") {
        layer.shapes = [
          group("plate", [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [42, 42] } },
            fill(COLORS.lavender, 90),
          ]),
          group("hub", [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 10] } },
            fill(COLORS.purple, 45),
          ]),
        ];
      } else if (prop.type === "pad") {
        layer.shapes = [
          group("pad", [
            { ty: "rc", d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [18, 34] }, r: { a: 0, k: 8 } },
            fill(COLORS.lavender),
          ]),
        ];
      }
      propLayers.push(layer);
    }
  }

  // Motion cue: small yellow arrow shown during the effort window, pointing
  // along the movement vector.
  let arrow = null;
  if (def.arrow) {
    const move = def.arrow.move ?? [0, -(def.arrow.rise ?? 40)];
    const [wa, wb] = def.arrow.window;
    const mid1 = wa + (wb - wa) * 0.3;
    const mid2 = wa + (wb - wa) * 0.75;
    const ind = nextInd++;
    arrow = layerBase(ind, "arrow", op, undefined);
    arrow.ks.r = { a: 0, k: deg(Math.atan2(move[1], move[0])) + 90 };
    arrow.ks.p = {
      a: 1,
      k: [
        { t: Math.round(wa * op), s: [def.arrow.at[0], def.arrow.at[1], 0], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(wb * op), s: [def.arrow.at[0] + move[0], def.arrow.at[1] + move[1], 0] },
      ],
    };
    arrow.ks.o = {
      a: 1,
      k: [
        { t: 0, s: [0], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(wa * op), s: [0], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(mid1 * op), s: [90], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(mid2 * op), s: [90], i: EASES.inout.i, o: EASES.inout.o },
        { t: Math.round(wb * op), s: [0] },
      ],
    };
    arrow.shapes = [
      group("arrow", [
        { ty: "sh", d: 1, ks: { a: 0, k: line2([0, 22], [0, -2]) } },
        stroke(COLORS.yellow, 7),
      ]),
      group("tip", [
        {
          ty: "sh",
          d: 1,
          ks: {
            a: 0,
            k: {
              c: true,
              i: [[0, 0], [0, 0], [0, 0]],
              o: [[0, 0], [0, 0], [0, 0]],
              v: [[-10, -2], [10, -2], [0, -20]],
            },
          },
        },
        fill(COLORS.yellow),
      ]),
    ];
  }

  // Static furniture (bench, wall, box, machine frames) in quiet lavender.
  let furniture = null;
  if (def.furniture?.length) {
    const ind = nextInd++;
    furniture = layerBase(ind, "furniture", op, undefined);
    furniture.shapes = def.furniture.map((f, i) => {
      if (f.kind === "rect") {
        return group(`f${i}`, [
          { ty: "rc", d: 1, p: { a: 0, k: [f.x, f.y] }, s: { a: 0, k: [f.w, f.h] }, r: { a: 0, k: f.r ?? 10 } },
          fill(COLORS.lavender, f.o ?? 50),
        ]);
      }
      if (f.kind === "circle") {
        return group(`f${i}`, [
          { ty: "el", p: { a: 0, k: [f.x, f.y] }, s: { a: 0, k: [f.r * 2, f.r * 2] } },
          fill(COLORS.lavender, f.o ?? 50),
        ]);
      }
      return group(`f${i}`, [
        { ty: "sh", d: 1, ks: { a: 0, k: line2([f.x1, f.y1], [f.x2, f.y2]) } },
        stroke(COLORS.lavender, f.w ?? 10, f.o ?? 70),
      ]);
    });
  }

  // Floor: quiet lavender ground line.
  let floor = null;
  if (def.floor !== false) {
    const ind = nextInd++;
    floor = layerBase(ind, "floor", op, undefined);
    floor.shapes = [
      group("floor", [
        { ty: "sh", d: 1, ks: { a: 0, k: line2([36, RIG.floorY], [476, RIG.floorY]) } },
        stroke(COLORS.lavender, 6, 65),
      ]),
    ];
  }

  // Stacking (first = topmost): arrow, core band, head, near arm (+its
  // props), torso, near leg, bands, far arm, far leg, furniture, floor.
  const near = bodyLayers.filter((b) => !b.far);
  const farL = bodyLayers.filter((b) => b.far);
  const pick = (list, ...keys) => keys.map((k) => list.find((b) => b.key === k)?.layer).filter(Boolean);
  const nearProps = propLayers.filter((l) => l.nm.endsWith("Near"));
  const farProps = propLayers.filter((l) => l.nm.endsWith("Far"));
  const ordered = [
    ...(arrow ? [arrow] : []),
    ...(coreBand ? [coreBand] : []),
    ...bandLayers.filter((l) => l._above),
    head,
    ...nearProps,
    ...pick(near, "forearmNear", "upperArmNear"),
    ...pick(near, "torso"),
    ...pick(near, "footNear", "shinNear", "thighNear"),
    ...bandLayers.filter((l) => !l._above),
    ...farProps,
    ...pick(farL, "forearmFar", "upperArmFar"),
    ...pick(farL, "footFar", "shinFar", "thighFar"),
    ...(furniture ? [furniture] : []),
    ...(floor ? [floor] : []),
    layers[0], // root null; array position irrelevant for nulls
  ];
  for (const l of ordered) delete l._above; // internal flag, not Lottie schema

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
