// Pushing exercises. Wrists are pinned with IK wherever hands bear weight so
// they never slide across the floor/wall/bench.
import { armIK, legIK, jointFrom } from "../rig.mjs";

// ── Push-up ─────────────────────────────────────────────────────────────────
const PUSHUP_ANKLE = [90, 443];
const PUSHUP_WRIST = [400, 473];

function pushupPose(at, shoulderY, headLift) {
  const bodyAngle = (Math.atan2(shoulderY - PUSHUP_ANKLE[1], 335) * 180) / Math.PI;
  const r = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(r), Math.sin(r)];
  const knee = [PUSHUP_ANKLE[0] + 100 * dir[0], PUSHUP_ANKLE[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  const shoulder = [hip[0] + 130 * dir[0], hip[1] + 130 * dir[1]];
  const arm = armIK(shoulder, PUSHUP_WRIST, "back");
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: bodyAngle + 180,
      shinNear: bodyAngle + 180,
      footNear: 107,
      headLift,
    },
  };
}

export const pushup = {
  id: "pushup",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  arrow: { at: [462, 402], move: [0, -42], window: [0.54, 0.98] },
  farPeek: { arm: 12, leg: 5 },
  poses: [pushupPose(0, 300, -6), pushupPose(0.42, 375, -18), pushupPose(0.52, 375, -18), pushupPose(1, 300, -6)],
};

// Knee push-up — pivot at the knees, shins resting on the floor.
const KNEE_PIVOT = [190, 460];
const KNEE_WRIST = [400, 473];
function kneePushupPose(at, shoulderY, headLift) {
  const bodyAngle = (Math.atan2(shoulderY - KNEE_PIVOT[1], 225) * 180) / Math.PI;
  const r = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(r), Math.sin(r)];
  const hip = [KNEE_PIVOT[0] + 105 * dir[0], KNEE_PIVOT[1] + 105 * dir[1]];
  const shoulder = [hip[0] + 130 * dir[0], hip[1] + 130 * dir[1]];
  const arm = armIK(shoulder, KNEE_WRIST, "back");
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: bodyAngle + 180,
      shinNear: 184,
      footNear: 184,
      headLift,
    },
  };
}
export const knee_pushup = {
  id: "knee_pushup",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  arrow: { at: [462, 400], move: [0, -40], window: [0.54, 0.98] },
  farPeek: { arm: 12, leg: 5 },
  poses: [
    kneePushupPose(0, 330, -6),
    kneePushupPose(0.42, 392, -16),
    kneePushupPose(0.52, 392, -16),
    kneePushupPose(1, 330, -6),
  ],
};

// Wall push-up — standing lean, hands on the wall.
const WALL_WRIST = [420, 205];
function wallPushupPose(at, bodyAngle, headLift) {
  const ankle = [255, 473];
  const r = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(r), Math.sin(r)];
  const knee = [ankle[0] + 100 * dir[0], ankle[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  const shoulder = [hip[0] + 130 * dir[0], hip[1] + 130 * dir[1]];
  const arm = armIK(shoulder, WALL_WRIST, "back");
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: bodyAngle + 180,
      shinNear: bodyAngle + 180,
      footNear: 0,
      headLift,
    },
  };
}
export const wall_pushup = {
  id: "wall_pushup",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [{ kind: "line", x1: 434, y1: 110, x2: 434, y2: 486, w: 10 }],
  arrow: { at: [300, 160], move: [-32, -8], window: [0.54, 0.95] },
  farPeek: { arm: 12, leg: 5 },
  poses: [wallPushupPose(0, -80, -4), wallPushupPose(0.42, -72, -10), wallPushupPose(0.52, -72, -10), wallPushupPose(1, -80, -4)],
};

// Dumbbell bench press — supine on the bench, bells press straight up.
function benchPressPose(at, wristY, opts = {}) {
  const hip = [295, 410];
  const shoulderTarget = [165, 405];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  const shoulder = jointFrom(hip, torso, 130);
  const legs = legIK(hip, [390, 473], "front");
  const arm = armIK(shoulder, [opts.wristX ?? 178, wristY], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: 0,
    },
  };
}
const BENCH = { kind: "rect", x: 256, y: 442, w: 240, h: 46, r: 10 };
const BENCH_LEGS = [
  { kind: "line", x1: 165, y1: 462, x2: 165, y2: 484, w: 12 },
  { kind: "line", x1: 350, y1: 462, x2: 350, y2: 484, w: 12 },
];
export const db_bench_press = {
  id: "db_bench_press",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  furniture: [BENCH, ...BENCH_LEGS],
  farPeek: { arm: 14, leg: 6 },
  arrow: { at: [110, 330], move: [0, -46], window: [0.54, 0.95] },
  poses: [benchPressPose(0, 258), benchPressPose(0.42, 342), benchPressPose(0.52, 342), benchPressPose(1, 258)],
};

// Barbell bench press — same body, plate seen end-on at the grip.
export const barbell_bench_press = {
  id: "barbell_bench_press",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "plate", parent: "forearmNear" }],
  furniture: [BENCH, ...BENCH_LEGS],
  farPeek: { arm: 14, leg: 6 },
  arrow: { at: [110, 330], move: [0, -46], window: [0.54, 0.95] },
  poses: [
    benchPressPose(0, 252, { wristX: 172 }),
    benchPressPose(0.42, 338, { wristX: 180 }),
    benchPressPose(0.52, 338, { wristX: 180 }),
    benchPressPose(1, 252, { wristX: 172 }),
  ],
};

// Standing overhead press — bells from the shoulders to overhead.
function ohpPose(at, wrist) {
  const hip = [240, 268];
  const torso = -90;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const overhead_press = {
  id: "overhead_press",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true, keepWorldAngle: 0 }],
  farPeek: { arm: 12, leg: 6 },
  arrow: { at: [340, 130], move: [0, -40], window: [0.05, 0.42] },
  poses: [ohpPose(0, [272, 156]), ohpPose(0.42, [252, 34]), ohpPose(0.54, [252, 34]), ohpPose(1, [272, 156])],
};

// Lateral raise — FRONT view; both arms rise to shoulder height.
function latRaisePose(at, up) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: -90,
      upperArmNear: up ? 4 : 78,
      forearmNear: up ? 0 : 82,
      upperArmFar: up ? 176 : 102,
      forearmFar: up ? 180 : 98,
      thighNear: 94,
      shinNear: 92,
      footNear: 30,
      thighFar: 86,
      shinFar: 88,
      footFar: 150,
      headLift: 0,
    },
  };
}
export const lateral_raise = {
  id: "lateral_raise",
  seconds: 2.6,
  farOpacity: 85,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  arrow: { at: [438, 200], move: [0, -34], window: [0.05, 0.42] },
  poses: [latRaisePose(0, false), latRaisePose(0.42, true), latRaisePose(0.54, true), latRaisePose(1, false)],
};

// Overhead triceps extension — elbows stay high, forearms fold and extend.
function tricepsExtPose(at, fore) {
  return {
    at,
    hip: [235, 268],
    angles: {
      torso: -88,
      upperArmNear: -62,
      forearmNear: fore,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: 2,
    },
  };
}
export const triceps_extension = {
  id: "triceps_extension",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", keepWorldAngle: 90 }],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [390, 90], move: [16, -32], window: [0.54, 0.95] },
  poses: [tricepsExtPose(0, 148), tricepsExtPose(0.42, -40), tricepsExtPose(0.54, -40), tricepsExtPose(1, 148)],
};

// Cable triceps pushdown — elbows pinned at the sides, cable from above.
function pushdownPose(at, fore) {
  return {
    at,
    hip: [230, 268],
    angles: {
      torso: -86,
      upperArmNear: 96,
      forearmNear: fore,
      thighNear: 92,
      shinNear: 88,
      footNear: 0,
      headLift: -2,
    },
  };
}
export const triceps_pushdown = {
  id: "triceps_pushdown",
  seconds: 2.4,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [
    { kind: "circle", x: 402, y: 116, r: 10 },
    { kind: "line", x1: 402, y1: 96, x2: 402, y2: 60, w: 10 },
  ],
  props: [{ type: "band", from: { point: [402, 122] }, to: { joint: "wristNear" }, w: 7 }],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [340, 250], move: [0, 40], window: [0.05, 0.42] },
  poses: [pushdownPose(0, -32), pushdownPose(0.42, 78), pushdownPose(0.54, 78), pushdownPose(1, -32)],
};

// Bench dips — hands behind on the bench edge, hips dip between reps.
function benchDipPose(at, shoulderY) {
  const wrist = [225, 410];
  const shoulder = [228, shoulderY];
  const hip = [shoulder[0] + 11.3, shoulder[1] + 129.5]; // torso -95 back-lean
  const legs = legIK(hip, [420, 458], "front");
  const arm = armIK(shoulder, wrist, "back");
  return {
    at,
    hip,
    angles: {
      torso: -95,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: -18,
      headLift: -6,
    },
  };
}
export const bench_dips = {
  id: "bench_dips",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [{ kind: "rect", x: 150, y: 448, w: 150, h: 70, r: 10 }],
  farPeek: { arm: 10, leg: 5 },
  arrow: { at: [320, 330], move: [0, -40], window: [0.54, 0.95] },
  poses: [benchDipPose(0, 272), benchDipPose(0.42, 330), benchDipPose(0.52, 330), benchDipPose(1, 272)],
};

export const PUSH = [
  pushup,
  knee_pushup,
  wall_pushup,
  db_bench_press,
  barbell_bench_press,
  overhead_press,
  lateral_raise,
  triceps_extension,
  triceps_pushdown,
  bench_dips,
];
