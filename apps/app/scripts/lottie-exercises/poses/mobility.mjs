// Warm-up / mobility drills. Cyclic moves (circles, marches) use linear
// easing so the loop reads as continuous motion instead of stepping.
import { armIK, legIK, jointFrom } from "../rig.mjs";

// March in place — alternating knee drives with opposite arm swing.
function marchPose(at, side) {
  // side: "near" knee up, "far" knee up, or "down" (both standing).
  const base = {
    at,
    hip: [240, side === "down" ? 268 : 264],
    angles: {
      torso: -88,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      thighFar: 90,
      shinFar: 90,
      footFar: 0,
      upperArmNear: 90,
      forearmNear: 80,
      upperArmFar: 90,
      forearmFar: 80,
      headLift: 0,
    },
  };
  if (side === "near") {
    base.angles.thighNear = 22;
    base.angles.shinNear = 82;
    base.angles.footNear = -8;
    base.angles.upperArmNear = 122;
    base.angles.forearmNear = 104;
    base.angles.upperArmFar = 58;
    base.angles.forearmFar = 36;
  } else if (side === "far") {
    base.angles.thighFar = 22;
    base.angles.shinFar = 82;
    base.angles.footFar = -8;
    base.angles.upperArmFar = 122;
    base.angles.forearmFar = 104;
    base.angles.upperArmNear = 58;
    base.angles.forearmNear = 36;
  }
  return base;
}
export const march_in_place = {
  id: "march_in_place",
  seconds: 2.2,
  farOpacity: 60,
  poses: [
    marchPose(0, "near"),
    marchPose(0.25, "down"),
    marchPose(0.5, "far"),
    marchPose(0.75, "down"),
    marchPose(1, "near"),
  ],
};

// Jumping jacks — front view, arms and legs open together with a small hop.
function jackPose(at, out) {
  return {
    at,
    hip: [240, out ? 258 : 268],
    angles: {
      torso: -90,
      upperArmNear: out ? -52 : 100,
      forearmNear: out ? -58 : 102,
      upperArmFar: out ? -128 : 80,
      forearmFar: out ? -122 : 78,
      thighNear: out ? 112 : 92,
      shinNear: out ? 114 : 90,
      footNear: out ? 42 : 28,
      thighFar: out ? 68 : 88,
      shinFar: out ? 66 : 90,
      footFar: out ? 138 : 152,
      headLift: 0,
    },
  };
}
export const jumping_jacks = {
  id: "jumping_jacks",
  seconds: 1.8,
  farOpacity: 85,
  poses: [jackPose(0, false), jackPose(0.5, true), jackPose(1, false)],
};

// Arm circles — straight arms sweep a full backward circle (linear loop).
function armCirclePose(at, angle) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: -90,
      upperArmNear: angle,
      forearmNear: angle,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: 0,
    },
  };
}
export const arm_circles = {
  id: "arm_circles",
  seconds: 2.6,
  ease: "linear",
  farPeek: { arm: 14, leg: 6 },
  poses: [
    armCirclePose(0, -90),
    armCirclePose(0.25, -180),
    armCirclePose(0.5, -270),
    armCirclePose(0.75, -360),
    armCirclePose(1, -450),
  ],
};

// Cat-cow — quadruped, the spine arches between cow (dip) and cat (round).
function catCowPose(at, arch, headLift) {
  const hip = [310, 370];
  const shoulderTarget = [180, 365];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  const shoulder = [180, 365];
  const arm = armIK(shoulder, [182, 473], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: 121,
      shinNear: 2,
      footNear: 0,
      headLift,
      torsoArch: arch,
    },
  };
}
export const cat_cow = {
  id: "cat_cow",
  seconds: 3.4,
  farPeek: { arm: 9, leg: 7 },
  poses: [catCowPose(0, 20, -20), catCowPose(0.5, -24, 12), catCowPose(1, 20, -20)],
};

// Hip circles — hands on the waist, pelvis traces a slow ellipse over
// planted feet (legs re-solved with IK every pose).
function hipCirclePose(at, dx, dy) {
  const hip = [240 + dx, 268 + dy];
  const near = legIK(hip, [258, 473], "front");
  const far = legIK(hip, [222, 473], "front");
  const shoulder = jointFrom(hip, -90, 130);
  const arm = armIK(shoulder, [hip[0] + 32, hip[1] - 28], "back");
  return {
    at,
    hip,
    angles: {
      torso: -90,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 0,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: 0,
      headLift: 0,
    },
  };
}
export const hip_circles = {
  id: "hip_circles",
  seconds: 3,
  ease: "linear",
  poses: [
    hipCirclePose(0, 18, 2),
    hipCirclePose(0.25, 0, 10),
    hipCirclePose(0.5, -18, 2),
    hipCirclePose(0.75, 0, -6),
    hipCirclePose(1, 18, 2),
  ],
};

// Leg swings — balance on the far leg, near leg swings like a pendulum.
function legSwingPose(at, thigh, shin) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: -88,
      upperArmNear: 68,
      forearmNear: 48,
      thighNear: thigh,
      shinNear: shin,
      footNear: shin + 12,
      thighFar: 90,
      shinFar: 90,
      footFar: 0,
      headLift: 0,
    },
  };
}
export const leg_swings = {
  id: "leg_swings",
  seconds: 2.2,
  farOpacity: 60,
  poses: [legSwingPose(0, 48, 54), legSwingPose(0.5, 128, 138), legSwingPose(1, 48, 54)],
};

// Band pull-apart — front view; hands start together at the chest, the band
// stretches wide as both arms open to the sides.
function pullApartPose(at, apart) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: -90,
      upperArmNear: apart ? 5 : 55,
      forearmNear: apart ? 0 : -120,
      upperArmFar: apart ? 175 : 125,
      forearmFar: apart ? 180 : 300,
      thighNear: 93,
      shinNear: 91,
      footNear: 28,
      thighFar: 87,
      shinFar: 89,
      footFar: 152,
      headLift: 0,
    },
  };
}
export const band_pull_apart = {
  id: "band_pull_apart",
  seconds: 2.6,
  farOpacity: 85,
  props: [{ type: "band", from: { joint: "wristNear" }, to: { joint: "wristFar" }, w: 8, above: true }],
  arrow: { at: [430, 110], move: [30, 0], window: [0.05, 0.42] },
  poses: [pullApartPose(0, false), pullApartPose(0.42, true), pullApartPose(0.54, true), pullApartPose(1, false)],
};

// Standing pelvic tilt — subtle by nature: gentle pelvic rock with a pulsing
// cue at the pelvis.
function pelvicTiltPose(at, tilted) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: tilted ? -86 : -91,
      upperArmNear: 62,
      forearmNear: 94,
      thighNear: 92,
      shinNear: 88,
      footNear: 0,
      headLift: 0,
      torsoArch: tilted ? -10 : 6,
    },
  };
}
export const pelvic_tilt = {
  id: "pelvic_tilt",
  seconds: 2.8,
  coreBand: { at: 0.08, size: [50, 50] },
  farPeek: { arm: 8, leg: 6 },
  poses: [pelvicTiltPose(0, false), pelvicTiltPose(0.5, true), pelvicTiltPose(1, false)],
};

export const MOBILITY = [
  march_in_place,
  jumping_jacks,
  arm_circles,
  cat_cow,
  hip_circles,
  leg_swings,
  band_pull_apart,
  pelvic_tilt,
];
