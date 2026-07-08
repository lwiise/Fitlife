// Pulling exercises — rows, pulldowns, curls. Cables/bands are drawn with
// world-space animated paths (rig prop type "band").
import { armIK, legIK, jointFrom } from "../rig.mjs";

// One-arm dumbbell row — far hand braced on the bench, near arm rows.
function oneArmRowPose(at, wrist) {
  const hip = [178, 328];
  const torso = -16;
  const shoulder = jointFrom(hip, torso, 130);
  const near = armIK(shoulder, wrist, "back");
  const farArm = armIK(shoulder, [352, 408], "back");
  const legs = legIK(hip, [205, 473], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: near.upper,
      forearmNear: near.fore,
      upperArmFar: farArm.upper,
      forearmFar: farArm.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: -16,
    },
  };
}
export const one_arm_db_row = {
  id: "one_arm_db_row",
  seconds: 2.6,
  highlight: ["upperArmNear"],
  props: [{ type: "dumbbell", parent: "forearmNear" }],
  furniture: [
    { kind: "rect", x: 356, y: 446, w: 160, h: 64, r: 10 },
    { kind: "line", x1: 300, y1: 466, x2: 300, y2: 484, w: 10 },
    { kind: "line", x1: 415, y1: 466, x2: 415, y2: 484, w: 10 },
  ],
  farPeek: { leg: 7 },
  arrow: { at: [252, 388], move: [0, -40], window: [0.05, 0.42] },
  poses: [
    oneArmRowPose(0, [300, 432]),
    oneArmRowPose(0.42, [306, 352]),
    oneArmRowPose(0.52, [306, 352]),
    oneArmRowPose(1, [300, 432]),
  ],
};

// Bent-over row — hinge held, both bells row to the ribs.
function bentRowPose(at, wrist) {
  const hip = [198, 315];
  const torso = -22;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  const legs = legIK(hip, [225, 473], "front");
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
      headLift: -18,
    },
  };
}
export const bent_over_row = {
  id: "bent_over_row",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [255, 380], move: [0, -40], window: [0.05, 0.42] },
  poses: [bentRowPose(0, [315, 428]), bentRowPose(0.42, [318, 348]), bentRowPose(0.52, [318, 348]), bentRowPose(1, [315, 428])],
};

// Seated cable row — legs long, pull the handle to the waist.
function cableRowPose(at, wrist) {
  const hip = [228, 430];
  const torso = -85;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  const legs = legIK(hip, [415, 452], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 55,
      headLift: -2,
    },
  };
}
export const seated_cable_row = {
  id: "seated_cable_row",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [
    { kind: "circle", x: 468, y: 392, r: 10 },
    { kind: "line", x1: 468, y1: 412, x2: 468, y2: 470, w: 10 },
  ],
  props: [{ type: "band", from: { point: [462, 392] }, to: { joint: "wristNear" }, w: 7 }],
  farPeek: { arm: 10, leg: 5 },
  arrow: { at: [345, 330], move: [-40, 0], window: [0.05, 0.42] },
  poses: [
    cableRowPose(0, [352, 388]),
    cableRowPose(0.42, [268, 372]),
    cableRowPose(0.52, [268, 372]),
    cableRowPose(1, [352, 388]),
  ],
};

// Lat pulldown — seated, bar pulled from overhead to the collarbone.
function pulldownPose(at, wrist) {
  const hip = [228, 408];
  const torso = -80;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  const legs = legIK(hip, [368, 473], "front");
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
export const lat_pulldown = {
  id: "lat_pulldown",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [
    { kind: "rect", x: 240, y: 462, w: 140, h: 44, r: 10 },
    { kind: "circle", x: 330, y: 66, r: 10 },
    { kind: "line", x1: 330, y1: 46, x2: 330, y2: 24, w: 10 },
  ],
  props: [{ type: "band", from: { point: [330, 72] }, to: { joint: "wristNear" }, w: 7 }],
  farPeek: { arm: 12, leg: 5 },
  arrow: { at: [420, 180], move: [0, 44], window: [0.05, 0.42] },
  poses: [
    pulldownPose(0, [312, 128]),
    pulldownPose(0.42, [300, 244]),
    pulldownPose(0.52, [300, 244]),
    pulldownPose(1, [312, 128]),
  ],
};

// Assisted pull-up — hands stay on the bar, body rises.
function pullupPose(at, shoulderY) {
  const wristNear = [262, 102];
  const wristFar = [286, 102];
  const shoulder = [258, shoulderY];
  const hip = [shoulder[0] + 6.8, shoulder[1] + 129.8]; // torso -87
  const near = armIK(shoulder, wristNear, "back");
  const far = armIK(shoulder, wristFar, "front");
  return {
    at,
    hip,
    angles: {
      torso: -87,
      upperArmNear: near.upper,
      forearmNear: near.fore,
      upperArmFar: far.upper,
      forearmFar: far.fore,
      thighNear: 100,
      shinNear: 150,
      footNear: 130,
      headLift: -2,
    },
  };
}
export const assisted_pullup = {
  id: "assisted_pullup",
  seconds: 2.8,
  floor: false,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [{ kind: "line", x1: 130, y1: 90, x2: 390, y2: 90, w: 12 }],
  farPeek: { leg: 7 },
  arrow: { at: [380, 240], move: [0, -46], window: [0.05, 0.42] },
  poses: [pullupPose(0, 252), pullupPose(0.42, 172), pullupPose(0.52, 172), pullupPose(1, 252)],
};

// Band row — band anchored ahead at chest height, elbows drive back.
function bandRowPose(at, wrist) {
  const hip = [198, 300];
  const torso = -85;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 93,
      shinNear: 87,
      footNear: 0,
      headLift: -2,
    },
  };
}
export const band_row = {
  id: "band_row",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [{ kind: "line", x1: 470, y1: 120, x2: 470, y2: 486, w: 8 }],
  props: [{ type: "band", from: { point: [468, 250] }, to: { joint: "wristNear" }, w: 8 }],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [340, 200], move: [-42, 0], window: [0.05, 0.42] },
  poses: [
    bandRowPose(0, [338, 242]),
    bandRowPose(0.42, [252, 228]),
    bandRowPose(0.52, [252, 228]),
    bandRowPose(1, [338, 242]),
  ],
};

// Face pull — anchored high, pull toward the face with elbows wide.
function facePullPose(at, wrist) {
  const hip = [198, 296];
  const torso = -87;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, wrist, "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 93,
      shinNear: 87,
      footNear: 0,
      headLift: -2,
    },
  };
}
export const face_pull = {
  id: "face_pull",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  furniture: [{ kind: "line", x1: 470, y1: 110, x2: 470, y2: 486, w: 8 }],
  props: [{ type: "band", from: { point: [468, 158] }, to: { joint: "wristNear" }, w: 8 }],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [345, 130], move: [-38, 0], window: [0.05, 0.42] },
  poses: [
    facePullPose(0, [345, 186]),
    facePullPose(0.42, [272, 158]),
    facePullPose(0.52, [272, 158]),
    facePullPose(1, [345, 186]),
  ],
};

// Rear-delt fly — hinged torso, straight-ish arms sweep back and up.
function rearDeltPose(at, up) {
  return {
    at,
    hip: [200, 315],
    angles: {
      torso: -22,
      upperArmNear: up ? 168 : 92,
      forearmNear: up ? 172 : 90,
      thighNear: 99,
      shinNear: 82,
      footNear: 0,
      headLift: -18,
    },
  };
}
export const rear_delt_fly = {
  id: "rear_delt_fly",
  seconds: 2.6,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  farPeek: { arm: 10, leg: 6 },
  arrow: { at: [235, 290], move: [-30, -26], window: [0.05, 0.42] },
  poses: [rearDeltPose(0, false), rearDeltPose(0.42, true), rearDeltPose(0.54, true), rearDeltPose(1, false)],
};

// Biceps curl — elbows pinned at the sides, forearms sweep up.
function curlPose(at, fore) {
  return {
    at,
    hip: [238, 268],
    angles: {
      torso: -90,
      upperArmNear: 95,
      forearmNear: fore,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const biceps_curl = {
  id: "biceps_curl",
  seconds: 2.4,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true }],
  farPeek: { arm: 9, leg: 6 },
  arrow: { at: [335, 300], move: [0, -36], window: [0.05, 0.42] },
  poses: [curlPose(0, 88), curlPose(0.42, -36), curlPose(0.54, -36), curlPose(1, 88)],
};

// Hammer curl — same arc, neutral (vertical) bell grip.
export const hammer_curl = {
  id: "hammer_curl",
  seconds: 2.4,
  highlight: ["upperArmNear", "upperArmFar"],
  props: [{ type: "dumbbell", parent: "forearmNear", far: true, keepWorldAngle: 90 }],
  farPeek: { arm: 9, leg: 6 },
  arrow: { at: [335, 300], move: [0, -36], window: [0.05, 0.42] },
  poses: [curlPose(0, 88), curlPose(0.42, -36), curlPose(0.54, -36), curlPose(1, 88)],
};

export const PULL = [
  one_arm_db_row,
  bent_over_row,
  seated_cable_row,
  lat_pulldown,
  assisted_pullup,
  band_row,
  face_pull,
  rear_delt_fly,
  biceps_curl,
  hammer_curl,
];
