// Core work — planks, supine flexion, quadruped balance, pelvic floor.
import { armIK, legIK } from "../rig.mjs";

// Forearm plank — static hold with breathing + core-band pulse.
function plankPose(at, hipLift) {
  const ankle = [80, 443];
  const shoulder = [412, 393 - hipLift];
  const bodyAngle = (Math.atan2(shoulder[1] - ankle[1], 335) * 180) / Math.PI;
  const r = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(r), Math.sin(r)];
  const knee = [ankle[0] + 100 * dir[0], ankle[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: 90,
      forearmNear: 0,
      thighNear: bodyAngle + 180,
      shinNear: bodyAngle + 180,
      footNear: 107,
      headLift: -10,
    },
  };
}
export const plank = {
  id: "plank",
  seconds: 3.2,
  coreBand: true,
  farPeek: { arm: 8, leg: 5 },
  poses: [plankPose(0, 0), plankPose(0.5, 4), plankPose(1, 0)],
};

// Side plank — supporting forearm down, top arm reaching up.
function sidePlankPose(at, lift) {
  const ankle = [90, 468];
  const shoulder = [412, 380 - lift];
  const bodyAngle = (Math.atan2(shoulder[1] - ankle[1], 335) * 180) / Math.PI;
  const r = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(r), Math.sin(r)];
  const knee = [ankle[0] + 100 * dir[0], ankle[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: 90,
      forearmNear: 0,
      upperArmFar: -95,
      forearmFar: -95,
      thighNear: bodyAngle + 180,
      shinNear: bodyAngle + 180,
      footNear: 100,
      thighFar: bodyAngle + 180,
      shinFar: bodyAngle + 180,
      footFar: 100,
      headLift: -8,
    },
  };
}
export const side_plank = {
  id: "side_plank",
  seconds: 3.2,
  coreBand: { at: 0.45, size: [48, 60] },
  farOpacity: 70,
  poses: [sidePlankPose(0, 0), sidePlankPose(0.5, 4), sidePlankPose(1, 0)],
};

// Dead bug — far limbs hold tabletop while the near arm/leg extend away.
function deadBugPose(at, extended) {
  const hip = [280, 458];
  const shoulderTarget = [150, 455];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  return {
    at,
    hip,
    angles: {
      torso,
      // Near arm: vertical → reaching back overhead (diagonal, stays on canvas).
      upperArmNear: extended ? -130 : -90,
      forearmNear: extended ? -136 : -90,
      // Near leg: tabletop → extended low hover.
      thighNear: extended ? -6 : -80,
      shinNear: extended ? 4 : 10,
      footNear: extended ? 30 : 20,
      // Far limbs hold tabletop throughout.
      upperArmFar: -84,
      forearmFar: -84,
      thighFar: -76,
      shinFar: 14,
      footFar: 24,
      headLift: 0,
    },
  };
}
export const dead_bug = {
  id: "dead_bug",
  seconds: 3,
  coreBand: { at: 0.5, size: [48, 56] },
  farOpacity: 45,
  poses: [deadBugPose(0, false), deadBugPose(0.45, true), deadBugPose(0.55, true), deadBugPose(1, false)],
};

// Bird dog — far limbs support on the floor, near arm/leg extend in balance.
function birdDogPose(at, extended) {
  const hip = [310, 370];
  const shoulderTarget = [180, 365];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  const shoulder = [180, 365];
  const farArm = armIK(shoulder, [175, 473], "back");
  const nearArmDown = armIK(shoulder, [190, 473], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: extended ? 195 : nearArmDown.upper,
      forearmNear: extended ? 187 : nearArmDown.fore,
      upperArmFar: farArm.upper,
      forearmFar: farArm.fore,
      thighNear: extended ? 20 : 121,
      shinNear: extended ? -45 : 2,
      footNear: extended ? -80 : 0,
      thighFar: 121,
      shinFar: 2,
      footFar: 0,
      headLift: -8,
    },
  };
}
export const bird_dog = {
  id: "bird_dog",
  seconds: 3.2,
  coreBand: { at: 0.5, size: [48, 56] },
  farOpacity: 50,
  poses: [birdDogPose(0, false), birdDogPose(0.42, true), birdDogPose(0.6, true), birdDogPose(1, false)],
};

// Crunch — shoulders curl up, hips stay planted, arms rigid with the torso.
function crunchPose(at, up) {
  const hip = [280, 455];
  const torso = up ? -166 : -179.5; // world: 180.5 flat ≡ -179.5, curls to -166
  const legs = legIK(hip, [358, 473], "front");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: torso - 13,
      forearmNear: torso + 140,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: up ? -10 : -2,
      torsoArch: up ? -14 : 0,
    },
  };
}
export const crunch = {
  id: "crunch",
  seconds: 2.6,
  coreBand: { at: 0.5, size: [48, 56] },
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [140, 400], move: [0, -30], window: [0.05, 0.42] },
  poses: [crunchPose(0, false), crunchPose(0.42, true), crunchPose(0.52, true), crunchPose(1, false)],
};

// Reverse crunch — shoulders stay down, pelvis curls, knees toward chest.
function revCrunchPose(at, curled) {
  const hip = curled ? [283, 438] : [290, 458];
  const shoulderTarget = [160, 456];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: 3,
      forearmNear: 0,
      thighNear: curled ? -120 : -85,
      shinNear: curled ? 45 : 15,
      footNear: curled ? 60 : 25,
      headLift: 0,
    },
  };
}
export const reverse_crunch = {
  id: "reverse_crunch",
  seconds: 2.6,
  coreBand: { at: 0.62, size: [46, 54] },
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [360, 310], move: [-26, -28], window: [0.05, 0.42] },
  poses: [revCrunchPose(0, false), revCrunchPose(0.42, true), revCrunchPose(0.52, true), revCrunchPose(1, false)],
};

// Lying leg raise — straight legs sweep from hover to vertical-ish.
function legRaisePose(at, up) {
  const hip = [270, 458];
  const shoulderTarget = [140, 456];
  const torso = (Math.atan2(shoulderTarget[1] - hip[1], shoulderTarget[0] - hip[0]) * 180) / Math.PI;
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: 3,
      forearmNear: 0,
      thighNear: up ? -60 : 2,
      shinNear: up ? -70 : 0,
      footNear: up ? -110 : -55,
      headLift: 0,
    },
  };
}
export const leg_raises = {
  id: "leg_raises",
  seconds: 2.8,
  coreBand: { at: 0.62, size: [46, 54] },
  farPeek: { arm: 8, leg: 6 },
  arrow: { at: [430, 380], move: [0, -46], window: [0.05, 0.42] },
  poses: [legRaisePose(0, false), legRaisePose(0.42, true), legRaisePose(0.52, true), legRaisePose(1, false)],
};

// Kegel / pelvic floor — seated tall; the pulsing band at the pelvis is the
// entire cue (nothing else should move).
function kegelPose(at, breathe) {
  const hip = [250, 377];
  const torso = -88;
  const legs = legIK(hip, [370, 473], "front");
  const arms = armIK([254.5, 247], [320, 375], "back");
  return {
    at,
    hip,
    angles: {
      torso,
      upperArmNear: arms.upper,
      forearmNear: arms.fore,
      thighNear: legs.thigh,
      shinNear: legs.shin,
      footNear: 0,
      headLift: breathe ? -3 : 0,
    },
  };
}
export const kegel = {
  id: "kegel",
  seconds: 3.4,
  coreBand: { at: 0.06, size: [52, 52] },
  furniture: [
    { kind: "rect", x: 255, y: 415, w: 150, h: 48, r: 10 },
    { kind: "line", x1: 200, y1: 440, x2: 200, y2: 484, w: 12 },
    { kind: "line", x1: 310, y1: 440, x2: 310, y2: 484, w: 12 },
  ],
  farPeek: { arm: 8, leg: 6 },
  poses: [kegelPose(0, false), kegelPose(0.5, true), kegelPose(1, false)],
};

export const CORE = [plank, side_plank, dead_bug, bird_dog, crunch, reverse_crunch, leg_raises, kegel];
