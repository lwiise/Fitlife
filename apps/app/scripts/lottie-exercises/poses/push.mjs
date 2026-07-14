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

// Arnold press — bells start in front of the face (elbows forward), press
// up in an arc to overhead.
function arnoldPose(at, wrist, bend) {
  const hip = [240, 268];
  const shoulder = jointFrom(hip, -90, 130);
  const arm = armIK(shoulder, wrist, bend);
  return {
    at,
    hip,
    angles: {
      torso: -90,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const arnold_press = {
  id: "arnold_press",
  seconds: 2.8,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true, keepWorldAngle: 0 }],
  farPeek: { arm: 12, leg: 6 },
  arrow: { at: [345, 130], move: [0, -40], window: [0.05, 0.42] },
  poses: [
    arnoldPose(0, [298, 190], "front"),
    arnoldPose(0.42, [252, 36], "back"),
    arnoldPose(0.54, [252, 36], "back"),
    arnoldPose(1, [298, 190], "front"),
  ],
};

// Incline dumbbell press — backrest at ~45°, bells press up-forward
// perpendicular to the torso.
function inclinePose(at, wristOff) {
  const hip = [278, 428];
  const torso = -138;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, [shoulder[0] + wristOff[0], shoulder[1] + wristOff[1]], "back");
  const legs = legIK(hip, [388, 473], "front");
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
      headLift: -4,
    },
  };
}
export const incline_db_press = {
  id: "incline_db_press",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  furniture: [
    { kind: "line", x1: 158, y1: 322, x2: 282, y2: 442, w: 18 },
    { kind: "rect", x: 320, y: 456, w: 100, h: 40, r: 8 },
    { kind: "line", x1: 220, y1: 452, x2: 220, y2: 484, w: 12 },
  ],
  farPeek: { arm: 14, leg: 6 },
  arrow: { at: [340, 200], move: [24, -28], window: [0.54, 0.95] },
  poses: [
    inclinePose(0, [34, -36]),
    inclinePose(0.42, [102, -110]),
    inclinePose(0.52, [102, -110]),
    inclinePose(1, [34, -36]),
  ],
};

// Seated machine chest press — upright seat, handles press straight forward.
function chestPressPose(at, wristX) {
  const hip = [190, 372];
  const torso = -85;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, [wristX, 258], "back");
  const legs = legIK(hip, [300, 473], "front");
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
      headLift: -2,
    },
  };
}
export const chest_press_machine = {
  id: "chest_press_machine",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "pad", parent: "forearmNear" }],
  furniture: [
    { kind: "line", x1: 148, y1: 210, x2: 148, y2: 452, w: 14 },
    { kind: "rect", x: 208, y: 434, w: 130, h: 40, r: 10 },
  ],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [368, 214], move: [34, 0], window: [0.05, 0.42] },
  poses: [chestPressPose(0, 258), chestPressPose(0.42, 352), chestPressPose(0.52, 352), chestPressPose(1, 258)],
};

// Machine chest fly — FRONT view: arms sweep from wide open to squeezed
// together in front of the chest.
function chestFlyPose(at, out) {
  const hip = [256, 300];
  const shoulder = jointFrom(hip, -90, 130);
  const nearW = out ? [402, 178] : [296, 222];
  const farW = out ? [110, 178] : [216, 222];
  const near = armIK(shoulder, nearW, "back");
  const far = armIK(shoulder, farW, "front");
  return {
    at,
    hip,
    angles: {
      torso: -90,
      upperArmNear: near.upper,
      forearmNear: near.fore,
      upperArmFar: far.upper,
      forearmFar: far.fore,
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
export const chest_fly_machine = {
  id: "chest_fly_machine",
  seconds: 2.6,
  farOpacity: 85,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "pad", parent: "forearmNear", far: true }],
  furniture: [
    { kind: "circle", x: 448, y: 140, r: 10 },
    { kind: "circle", x: 64, y: 140, r: 10 },
  ],
  arrow: { at: [400, 150], move: [-34, 0], window: [0.05, 0.42] },
  poses: [chestFlyPose(0, true), chestFlyPose(0.42, false), chestFlyPose(0.54, false), chestFlyPose(1, true)],
};

// Cable lateral raise — FRONT view: the working arm sweeps out to shoulder
// height against a low cable crossing the body.
function cableLatPose(at, up) {
  const hip = [256, 268];
  const shoulder = jointFrom(hip, -90, 130);
  const arm = armIK(shoulder, up ? [406, 150] : [228, 296], "back");
  return {
    at,
    hip,
    angles: {
      torso: -90,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      upperArmFar: 96,
      forearmFar: 92,
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
export const cable_lateral_raise = {
  id: "cable_lateral_raise",
  seconds: 2.6,
  farOpacity: 85,
  highlight: ["upperArmNear"],
  furniture: [
    { kind: "circle", x: 88, y: 462, r: 10 },
    { kind: "line", x1: 60, y1: 478, x2: 116, y2: 478, w: 8 },
  ],
  props: [{ type: "band", from: { point: [88, 456] }, to: { joint: "wristNear" }, w: 7, above: true }],
  arrow: { at: [432, 220], move: [0, -34], window: [0.05, 0.42] },
  poses: [cableLatPose(0, false), cableLatPose(0.42, true), cableLatPose(0.54, true), cableLatPose(1, false)],
};

// Cable front raise — facing away from a low pulley, straight arm sweeps
// from the thigh to shoulder height in front.
function cableFrontPose(at, wrist) {
  const hip = [225, 268];
  const torso = -88;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 92,
      shinNear: 88,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const cable_front_raise = {
  id: "cable_front_raise",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [
    { kind: "circle", x: 70, y: 456, r: 10 },
    { kind: "line", x1: 70, y1: 472, x2: 70, y2: 486, w: 10 },
  ],
  props: [{ type: "band", from: { point: [76, 456] }, to: { joint: "wristNear" }, w: 7 }],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [400, 220], move: [0, -36], window: [0.05, 0.42] },
  poses: [
    cableFrontPose(0, [282, 288]),
    cableFrontPose(0.42, [380, 146]),
    cableFrontPose(0.54, [380, 146]),
    cableFrontPose(1, [282, 288]),
  ],
};

export const PUSH = [
  pushup,
  knee_pushup,
  wall_pushup,
  db_bench_press,
  barbell_bench_press,
  incline_db_press,
  chest_press_machine,
  chest_fly_machine,
  overhead_press,
  arnold_press,
  lateral_raise,
  cable_lateral_raise,
  cable_front_raise,
  triceps_extension,
  triceps_pushdown,
  bench_dips,
];
