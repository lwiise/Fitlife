// Lower-body exercises. World angles per rig.mjs convention (figure faces
// right; 0° = +x, 90° = down, -90° = up). Contact points (feet, benches)
// verified with --debug FK output + the QA screenshot sheet.
import { armIK, legIK, jointFrom } from "../rig.mjs";

// ── Squat family ────────────────────────────────────────────────────────────
const squatTop = {
  at: 0,
  hip: [240, 268],
  angles: { torso: -90, upperArmNear: 78, forearmNear: 66, thighNear: 90, shinNear: 90, footNear: 0, headLift: 0 },
};
const squatBottom = {
  at: 0.42,
  hip: [215, 342],
  angles: { torso: -55, upperArmNear: -10, forearmNear: -2, thighNear: 33, shinNear: 130, footNear: 0, headLift: -24 },
};

export const squat = {
  id: "squat",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  arrow: { at: [330, 390], move: [0, -46], window: [0.56, 0.98] },
  farPeek: { arm: 10, leg: 8 },
  poses: [squatTop, squatBottom, { ...squatBottom, at: 0.54 }, { ...squatTop, at: 1 }],
};

// Goblet: same legs, bell held at the chest with both hands.
function gobletArms(pose) {
  const shoulder = jointFrom(pose.hip, pose.angles.torso, 130);
  const a = armIK(shoulder, [shoulder[0] + 52, shoulder[1] + 72], "back");
  return {
    ...pose,
    angles: { ...pose.angles, upperArmNear: a.upper, forearmNear: a.fore },
  };
}
const gobTop = gobletArms({ ...squatTop });
const gobBottom = gobletArms({ ...squatBottom, angles: { ...squatBottom.angles, torso: -62, headLift: -20 } });
export const goblet_squat = {
  id: "goblet_squat",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  arrow: { at: [340, 390], move: [0, -46], window: [0.56, 0.98] },
  farPeek: { arm: 6, leg: 8 },
  props: [{ type: "dumbbell", parent: "forearmNear", keepWorldAngle: 90 }],
  poses: [gobTop, { ...gobBottom, at: 0.42 }, { ...gobBottom, at: 0.54 }, { ...gobTop, at: 1 }],
};

// Wall sit — isometric hold against the wall, thighs parallel to the floor.
function wallSitPose(at, lift) {
  return {
    at,
    hip: [172, 373 - lift],
    angles: {
      torso: -90,
      upperArmNear: 60,
      forearmNear: 92,
      thighNear: 0,
      shinNear: 90,
      footNear: 0,
      headLift: -2,
    },
  };
}
export const wall_sit = {
  id: "wall_sit",
  seconds: 3.2,
  highlight: ["thighNear", "thighFar"],
  furniture: [{ kind: "line", x1: 152, y1: 120, x2: 152, y2: 486, w: 10 }],
  farPeek: { arm: 8, leg: 6 },
  poses: [wallSitPose(0, 0), wallSitPose(0.5, 3), wallSitPose(1, 0)],
};

// Leg press — feet stay planted on the plate; the sliding seat carries the
// body toward/away from it (how the machine actually behaves).
const PRESS_ANKLE = [382, 296];
function legPressPose(at, hip) {
  const torso = -128;
  const shoulder = jointFrom(hip, torso, 130);
  const legs = legIK(hip, PRESS_ANKLE, "front");
  const arms = armIK(shoulder, [hip[0] + 30, hip[1] + 14], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arms.upper,
      forearmNear: arms.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: legs.shin - 90,
      headLift: -8,
    },
  };
}
export const leg_press = {
  id: "leg_press",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  furniture: [
    { kind: "line", x1: 108, y1: 314, x2: 186, y2: 450, w: 14 },
    { kind: "line", x1: 186, y1: 450, x2: 290, y2: 470, w: 14 },
    { kind: "line", x1: 356, y1: 246, x2: 442, y2: 332, w: 16 },
  ],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [300, 250], move: [-34, 30], window: [0.56, 0.95] },
  poses: [
    legPressPose(0, [192, 424]),
    legPressPose(0.42, [238, 388]),
    legPressPose(0.54, [238, 388]),
    legPressPose(1, [192, 424]),
  ],
};

// Split squat — rear foot on the toe, front foot planted.
function splitSquatPose(at, hipY, headLift) {
  const hip = [228, hipY];
  const near = legIK(hip, [292, 473], "front");
  const far = legIK(hip, [158, 452], "front");
  return {
    at,
    hip,
    angles: {
      torso: -84,
      upperArmNear: 55,
      forearmNear: 95,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 0,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: 112,
      headLift,
    },
  };
}
export const split_squat = {
  id: "split_squat",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  arrow: { at: [330, 380], move: [0, -44], window: [0.56, 0.98] },
  poses: [
    splitSquatPose(0, 296, 0),
    splitSquatPose(0.42, 356, -6),
    splitSquatPose(0.54, 356, -6),
    splitSquatPose(1, 296, 0),
  ],
};

// Forward lunge — step out, sink, push back to standing.
const lungeStand = {
  at: 0,
  hip: [225, 268],
  angles: { torso: -90, upperArmNear: 80, forearmNear: 70, thighNear: 90, shinNear: 90, footNear: 0, headLift: 0 },
};
function lungeBottom(at) {
  const hip = [232, 352];
  const near = legIK(hip, [312, 473], "front");
  const far = legIK(hip, [148, 452], "front");
  return {
    at,
    hip,
    angles: {
      torso: -82,
      upperArmNear: 60,
      forearmNear: 96,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 0,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: 112,
      headLift: -4,
    },
  };
}
export const lunge = {
  id: "lunge",
  seconds: 3,
  highlight: ["thighNear", "thighFar"],
  arrow: { at: [340, 380], move: [0, -44], window: [0.6, 0.98] },
  poses: [lungeStand, lungeBottom(0.42), lungeBottom(0.54), { ...lungeStand, at: 1 }],
};

// Step-up onto a box (top surface y=420).
function stepUpPose(at, hip, nearAnkle, farAnkle, farFoot = 0) {
  const near = legIK(hip, nearAnkle, "front");
  const far = legIK(hip, farAnkle, "front");
  return {
    at,
    hip,
    angles: {
      torso: -84,
      upperArmNear: 62,
      forearmNear: 90,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 0,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: farFoot,
      headLift: -2,
    },
  };
}
export const step_up = {
  id: "step_up",
  seconds: 3.2,
  highlight: ["thighNear", "thighFar"],
  furniture: [{ kind: "rect", x: 365, y: 453, w: 130, h: 66, r: 8 }],
  arrow: { at: [452, 340], move: [0, -44], window: [0.28, 0.55] },
  poses: [
    stepUpPose(0, [212, 272], [212, 473], [200, 473]),
    stepUpPose(0.28, [232, 292], [345, 407], [200, 473]),
    stepUpPose(0.52, [340, 208], [345, 407], [305, 428], 40),
    stepUpPose(0.76, [232, 292], [345, 407], [200, 473]),
    stepUpPose(1, [212, 272], [212, 473], [200, 473]),
  ],
};

// Romanian deadlift — hips back, flat back, bells slide along the thighs.
const rdlTop = {
  at: 0,
  hip: [235, 268],
  angles: { torso: -90, upperArmNear: 92, forearmNear: 90, thighNear: 90, shinNear: 90, footNear: 0, headLift: 0 },
};
const rdlBottom = {
  at: 0.42,
  hip: [205, 288],
  angles: { torso: -24, upperArmNear: 92, forearmNear: 90, thighNear: 97, shinNear: 86, footNear: 0, headLift: -20 },
};
export const romanian_deadlift = {
  id: "romanian_deadlift",
  seconds: 3,
  highlight: ["thighNear", "thighFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [352, 300], move: [0, -44], window: [0.56, 0.98] },
  poses: [rdlTop, rdlBottom, { ...rdlBottom, at: 0.54 }, { ...rdlTop, at: 1 }],
};

// Glute bridge — shoulders stay down, hips drive up.
function bridgePose(at, hipY) {
  const hip = [255, hipY];
  const shoulderTarget = [150, 458];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  const legs = legIK(hip, [330, 473], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: -4,
      forearmNear: 4,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const glute_bridge = {
  id: "glute_bridge",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  coreBand: { at: 0.06, size: [50, 50] },
  arrow: { at: [255, 420], move: [0, -44], window: [0.05, 0.4] },
  farPeek: { arm: 8, leg: 6 },
  poses: [bridgePose(0, 452), bridgePose(0.42, 392), bridgePose(0.54, 392), bridgePose(1, 452)],
};

// Hip thrust — like the bridge but shoulders elevated on a bench.
function thrustPose(at, hipY) {
  const hip = [265, hipY];
  const shoulderTarget = [142, 378];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  const legs = legIK(hip, [345, 473], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: 20,
      forearmNear: 30,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: -6,
    },
  };
}
export const hip_thrust = {
  id: "hip_thrust",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  coreBand: { at: 0.06, size: [50, 50] },
  furniture: [{ kind: "rect", x: 118, y: 438, w: 130, h: 96, r: 10 }],
  arrow: { at: [268, 420], move: [0, -42], window: [0.05, 0.4] },
  farPeek: { arm: 8, leg: 6 },
  poses: [thrustPose(0, 442), thrustPose(0.42, 376), thrustPose(0.54, 376), thrustPose(1, 442)],
};

// Seated machine leg extension — shin swings out against the pad.
function legExtPose(at, shin) {
  const hip = [200, 370];
  const torso = -78;
  const shoulder = jointFrom(hip, torso, 130);
  const arms = armIK(shoulder, [238, 396], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arms.upper,
      forearmNear: arms.fore,
      thighNear: 0,
      shinNear: shin,
      footNear: shin - 72,
      headLift: -2,
    },
  };
}
export const leg_extension = {
  id: "leg_extension",
  seconds: 2.6,
  highlight: ["thighNear", "thighFar"],
  props: [{ type: "pad", parent: "shinNear" }],
  furniture: [
    { kind: "rect", x: 205, y: 420, w: 150, h: 44, r: 10 },
    { kind: "line", x1: 138, y1: 330, x2: 138, y2: 452, w: 14 },
    { kind: "line", x1: 170, y1: 452, x2: 240, y2: 452, w: 10 },
  ],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [390, 320], move: [16, -34], window: [0.05, 0.42] },
  poses: [legExtPose(0, 92), legExtPose(0.42, 6), legExtPose(0.54, 6), legExtPose(1, 92)],
};

// Seated machine leg curl — shin curls down-back against the pad.
export const leg_curl = {
  id: "leg_curl",
  seconds: 2.6,
  highlight: ["thighNear", "thighFar"],
  props: [{ type: "pad", parent: "shinNear" }],
  furniture: [
    { kind: "rect", x: 205, y: 420, w: 150, h: 44, r: 10 },
    { kind: "line", x1: 138, y1: 330, x2: 138, y2: 452, w: 14 },
    { kind: "line", x1: 170, y1: 452, x2: 240, y2: 452, w: 10 },
  ],
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [388, 430], move: [-10, 34], window: [0.05, 0.42] },
  poses: [legExtPose(0, 10), legExtPose(0.42, 96), legExtPose(0.54, 96), legExtPose(1, 10)],
};

// Standing calf raise — toes stay planted, heels drive up.
const calfFlat = {
  at: 0,
  hip: [245, 268],
  angles: { torso: -90, upperArmNear: 82, forearmNear: 72, thighNear: 90, shinNear: 90, footNear: 0, headLift: 0 },
};
const calfUp = {
  at: 0.42,
  hip: [245, 247],
  angles: { torso: -90, upperArmNear: 82, forearmNear: 72, thighNear: 90, shinNear: 90, footNear: 28, headLift: 0 },
};
export const calf_raise = {
  id: "calf_raise",
  seconds: 2.4,
  highlight: ["shinNear", "shinFar"],
  arrow: { at: [330, 420], move: [0, -36], window: [0.05, 0.4] },
  poses: [calfFlat, calfUp, { ...calfUp, at: 0.54 }, { ...calfFlat, at: 1 }],
};

export const LEGS = [
  squat,
  goblet_squat,
  wall_sit,
  leg_press,
  split_squat,
  lunge,
  step_up,
  romanian_deadlift,
  glute_bridge,
  hip_thrust,
  leg_extension,
  leg_curl,
  calf_raise,
];
