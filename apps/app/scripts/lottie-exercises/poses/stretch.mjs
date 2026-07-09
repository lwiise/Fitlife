// Cool-down stretches — static holds with a breathing cycle (the second pose
// deepens the stretch slightly, then releases).
import { armIK, legIK, jointFrom } from "../rig.mjs";

// Standing hamstring stretch — front heel down, hinge over the long leg.
function hamstringPose(at, torso) {
  const hip = [215, 290];
  const near = legIK(hip, [330, 466], "front");
  const far = legIK(hip, [205, 473], "front");
  const shoulder = jointFrom(hip, torso, 130);
  const arm = armIK(shoulder, [326, 374], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: -58,
      thighFar: far.thigh,
      shinFar: far.shin,
      footFar: 0,
      headLift: -16,
    },
  };
}
export const hamstring_stretch = {
  id: "hamstring_stretch",
  seconds: 3.4,
  highlight: ["thighNear"],
  poses: [hamstringPose(0, -36), hamstringPose(0.5, -31), hamstringPose(1, -36)],
};

// Standing quad stretch — heel pulled to the glute, hand on the ankle.
function quadPose(at, shin) {
  const hip = [240, 268];
  const knee = jointFrom(hip, 100, 105);
  const ankle = jointFrom(knee, shin, 100);
  const shoulder = jointFrom(hip, -88, 130);
  const near = armIK(shoulder, [ankle[0] + 4, ankle[1] - 4], "back");
  return {
    at,
    hip,
    angles: {
      torso: -88,
      upperArmNear: near.upper,
      forearmNear: near.fore,
      upperArmFar: 42,
      forearmFar: 18,
      thighNear: 100,
      shinNear: shin,
      footNear: shin + 20,
      thighFar: 90,
      shinFar: 90,
      footFar: 0,
      headLift: 0,
    },
  };
}
export const quad_stretch = {
  id: "quad_stretch",
  seconds: 3.4,
  highlight: ["thighNear"],
  farOpacity: 55,
  poses: [quadPose(0, 248), quadPose(0.5, 243), quadPose(1, 248)],
};

// Chest stretch — both arms drawn back and down, chest open, gentle arch.
function chestPose(at, back) {
  return {
    at,
    hip: [240, 268],
    angles: {
      torso: -92,
      upperArmNear: back ? 157 : 150,
      forearmNear: back ? 167 : 160,
      thighNear: 90,
      shinNear: 90,
      footNear: 0,
      headLift: -6,
      torsoArch: -8,
    },
  };
}
export const chest_stretch = {
  id: "chest_stretch",
  seconds: 3.4,
  coreBand: { at: 0.85, size: [46, 46] },
  farPeek: { arm: 12, leg: 6 },
  poses: [chestPose(0, false), chestPose(0.5, true), chestPose(1, false)],
};

// Child's pose — kneeling fold, arms long on the floor, back rounded.
function childPose(at, sink) {
  return {
    at,
    hip: [300, 400 + sink],
    angles: {
      torso: 160,
      upperArmNear: 185,
      forearmNear: 175,
      thighNear: 145,
      shinNear: -5,
      footNear: 0,
      headLift: 4,
      torsoArch: 14,
    },
  };
}
export const child_pose = {
  id: "child_pose",
  seconds: 3.6,
  farPeek: { arm: 8, leg: 6 },
  poses: [childPose(0, 0), childPose(0.5, 3), childPose(1, 0)],
};

// Kneeling hip-flexor stretch — rear knee down, hips press gently forward.
function hipFlexorPose(at, hipX) {
  const hip = [hipX, 368];
  const near = legIK(hip, [335, 470], "front");
  const farKnee = [160, 455];
  const farThigh = (Math.atan2(farKnee[1] - hip[1], farKnee[0] - hip[0]) * 180) / Math.PI;
  const shoulder = jointFrom(hip, -85, 130);
  const arm = armIK(shoulder, [310, 380], "back");
  return {
    at,
    hip,
    angles: {
      torso: -85,
      upperArmNear: arm.upper,
      forearmNear: arm.fore,
      thighNear: near.thigh,
      shinNear: near.shin,
      footNear: 0,
      thighFar: farThigh,
      shinFar: 185,
      footFar: 190,
      headLift: 0,
    },
  };
}
export const hip_flexor_stretch = {
  id: "hip_flexor_stretch",
  seconds: 3.4,
  coreBand: { at: 0.08, size: [46, 46] },
  poses: [hipFlexorPose(0, 225), hipFlexorPose(0.5, 238), hipFlexorPose(1, 225)],
};

export const STRETCH = [hamstring_stretch, quad_stretch, chest_stretch, child_pose, hip_flexor_stretch];
