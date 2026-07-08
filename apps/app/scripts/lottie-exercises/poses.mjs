// Exercise pose definitions — world angles per keyframe (see rig.mjs for the
// convention: 0° = facing direction (+x, figure faces right), 90° = down,
// -90° = up). Every definition must start and end on the same pose so the
// loop is seamless. Numbers are tuned against the QA screenshot grid.

import { ik2 } from "./rig.mjs";

// ── Squat (bodyweight) ──────────────────────────────────────────────────────
// Feet flat (floor 486 → foot line at 473), hips drop back-and-down, torso
// keeps a confident forward lean, arms raise forward for balance.
const squatTop = {
  at: 0,
  hip: [240, 268],
  angles: {
    torso: -90,
    upperArmNear: 78,
    forearmNear: 66,
    thighNear: 90,
    shinNear: 90,
    footNear: 0,
    headLift: 0,
  },
};
const squatBottom = {
  at: 0.42,
  hip: [215, 342],
  angles: {
    torso: -55,
    upperArmNear: -10,
    forearmNear: -2,
    thighNear: 33,
    shinNear: 130,
    footNear: 0,
    headLift: -24,
  },
};

export const squat = {
  id: "squat",
  seconds: 2.8,
  highlight: ["thighNear", "thighFar"],
  arrow: { at: [330, 390], rise: 46, window: [0.56, 0.98] },
  farPeek: { arm: 10, leg: 8 },
  poses: [
    squatTop,
    squatBottom,
    { ...squatBottom, at: 0.54 }, // brief hold at depth
    { ...squatTop, at: 1 },
  ],
};

// ── Push-up ─────────────────────────────────────────────────────────────────
// Toes fixed at the left, hands planted (wrist pinned via IK so the hands
// never slide), body stays one straight line hip-to-shoulder.
const PUSHUP_ANKLE = [90, 443];
const PUSHUP_WRIST = [400, 473];

function pushupPose(at, shoulderY, headLift) {
  // Body line from the ankle through knee/hip to the shoulder.
  const bodyAngle =
    (Math.atan2(shoulderY - PUSHUP_ANKLE[1], 335) * 180) / Math.PI;
  const rad = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(rad), Math.sin(rad)];
  const knee = [PUSHUP_ANKLE[0] + 100 * dir[0], PUSHUP_ANKLE[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  const shoulder = [hip[0] + 130 * dir[0], hip[1] + 130 * dir[1]];
  const arm = ik2(shoulder, PUSHUP_WRIST, 80, 75, "back");
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: arm.a1,
      forearmNear: arm.a2,
      // Legs point back toward the ankle (opposite of the body direction).
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
  arrow: { at: [462, 402], rise: 42, window: [0.54, 0.98] },
  farPeek: { arm: 12, leg: 5 },
  poses: [
    pushupPose(0, 300, -6), // top, arms long
    pushupPose(0.42, 375, -18), // chest low, head looking forward
    pushupPose(0.52, 375, -18), // brief hold
    pushupPose(1, 300, -6),
  ],
};

// ── Plank (forearm) ─────────────────────────────────────────────────────────
// Static hold: forearms flat on the floor, body one line, subtle breathing
// through the hips + the pink core band pulse carries the "feel it here" cue.
function plankPose(at, hipLift) {
  const ankle = [80, 443];
  const shoulder = [412, 393 - hipLift];
  const bodyAngle =
    (Math.atan2(shoulder[1] - ankle[1], 335) * 180) / Math.PI;
  const rad = (bodyAngle * Math.PI) / 180;
  const dir = [Math.cos(rad), Math.sin(rad)];
  const knee = [ankle[0] + 100 * dir[0], ankle[1] + 100 * dir[1]];
  const hip = [knee[0] + 105 * dir[0], knee[1] + 105 * dir[1]];
  return {
    at,
    hip,
    angles: {
      torso: bodyAngle,
      upperArmNear: 90, // straight down to the floor elbow
      forearmNear: 0, // forearm flat, pointing forward
      thighNear: bodyAngle + 180,
      shinNear: bodyAngle + 180,
      footNear: 107,
      headLift: -10, // neck long, gaze slightly ahead of the hands
    },
  };
}

export const plank = {
  id: "plank",
  seconds: 3.2,
  highlight: [],
  coreBand: true,
  farPeek: { arm: 8, leg: 5 },
  poses: [plankPose(0, 0), plankPose(0.5, 4), plankPose(1, 0)],
};

export const ALL = [squat, pushup, plank];
