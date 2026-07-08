// Cardio — walk cycles and the stationary bike (linear easing throughout so
// the cycles read as continuous motion).
import { armIK, legIK, jointFrom } from "../rig.mjs";

// Shared 4-phase walk cycle. Legs stride front/back (contact → passing →
// mirrored contact → passing), arms counter-swing, slight forward lean.
function walkPose(at, phase, hipY = 270) {
  const P = {
    contactNear: {
      thighNear: 65, shinNear: 80, footNear: -20,
      thighFar: 115, shinFar: 130, footFar: 60,
      upperArmNear: 115, forearmNear: 105, upperArmFar: 65, forearmFar: 45,
      dy: 0,
    },
    passing1: {
      thighNear: 88, shinNear: 95, footNear: 15,
      thighFar: 100, shinFar: 135, footFar: 55,
      upperArmNear: 90, forearmNear: 80, upperArmFar: 90, forearmFar: 100,
      dy: -4,
    },
    contactFar: {
      thighNear: 115, shinNear: 130, footNear: 60,
      thighFar: 65, shinFar: 80, footFar: -20,
      upperArmNear: 65, forearmNear: 45, upperArmFar: 115, forearmFar: 105,
      dy: 0,
    },
    passing2: {
      thighNear: 100, shinNear: 135, footNear: 55,
      thighFar: 88, shinFar: 95, footFar: 15,
      upperArmNear: 90, forearmNear: 100, upperArmFar: 90, forearmFar: 80,
      dy: -4,
    },
  }[phase];
  return {
    at,
    hip: [240, hipY + P.dy],
    angles: {
      torso: -86,
      upperArmNear: P.upperArmNear,
      forearmNear: P.forearmNear,
      upperArmFar: P.upperArmFar,
      forearmFar: P.forearmFar,
      thighNear: P.thighNear,
      shinNear: P.shinNear,
      footNear: P.footNear,
      thighFar: P.thighFar,
      shinFar: P.shinFar,
      footFar: P.footFar,
      headLift: 0,
    },
  };
}
const WALK_POSES = (hipY) => [
  walkPose(0, "contactNear", hipY),
  walkPose(0.25, "passing1", hipY),
  walkPose(0.5, "contactFar", hipY),
  walkPose(0.75, "passing2", hipY),
  walkPose(1, "contactNear", hipY),
];

export const brisk_walk = {
  id: "brisk_walk",
  seconds: 1.9,
  ease: "linear",
  farOpacity: 55,
  poses: WALK_POSES(270),
};

// Treadmill walk — same cycle on a machine deck with a console upright.
export const incline_walk = {
  id: "incline_walk",
  seconds: 1.9,
  ease: "linear",
  farOpacity: 55,
  floor: false,
  furniture: [
    { kind: "line", x1: 84, y1: 478, x2: 440, y2: 478, w: 14 },
    { kind: "line", x1: 430, y1: 470, x2: 448, y2: 330, w: 12 },
    { kind: "line", x1: 418, y1: 330, x2: 478, y2: 330, w: 12 },
  ],
  poses: WALK_POSES(272),
};

// Stationary bike — seated, hands on the bars, feet tracing the pedal circle
// (far leg half a revolution out of phase).
const CRANK = [268, 424];
const PEDAL_R = 44;
function pedalTarget(angleDeg) {
  return [CRANK[0] + PEDAL_R * Math.cos((angleDeg * Math.PI) / 180), CRANK[1] + PEDAL_R * Math.sin((angleDeg * Math.PI) / 180)];
}
function bikePose(at, crankAngle) {
  const hip = [212, 290];
  const torso = -58;
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, [332, 262], "back");
  const near = legIK(hip, pedalTarget(crankAngle), "front");
  const far = legIK(hip, pedalTarget(crankAngle + 180), "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 25,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: 25,
      headLift: -10,
    },
  };
}
export const stationary_bike = {
  id: "stationary_bike",
  seconds: 2.2,
  ease: "linear",
  farOpacity: 55,
  highlight: ["thighNear", "thighFar"],
  furniture: [
    { kind: "line", x1: 190, y1: 470, x2: 352, y2: 470, w: 12 },
    { kind: "line", x1: 214, y1: 306, x2: 240, y2: 424, w: 12 },
    { kind: "line", x1: 240, y1: 424, x2: 268, y2: 424, w: 12 },
    { kind: "circle", x: 268, y: 424, r: 12 },
    { kind: "line", x1: 268, y1: 424, x2: 322, y2: 344, w: 10 },
    { kind: "line", x1: 322, y1: 344, x2: 336, y2: 268, w: 10 },
    { kind: "line", x1: 322, y1: 258, x2: 350, y2: 262, w: 10 },
    { kind: "rect", x: 212, y: 300, w: 54, h: 16, r: 8 },
  ],
  poses: [bikePose(0, 90), bikePose(0.25, 180), bikePose(0.5, 270), bikePose(0.75, 360), bikePose(1, 450)],
};

export const CARDIO = [brisk_walk, incline_walk, stationary_bike];
