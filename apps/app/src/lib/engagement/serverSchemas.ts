import { z } from "zod";

import {
  CHECKIN_REASONS,
  CHECKIN_SLOTS,
  CHECKIN_STATUSES,
  VERDICTS,
} from "./types";

// Server-side validation for the engagement actions (ختام اليوم). Same stance
// as onboarding/serverSchemas.ts: a passing client never trips these — they
// exist for hand-crafted requests. Enum-like DB text columns are constrained
// HERE, not with DB CHECKs (house convention; keeps Ramadan slots a config
// change).

const uuid = z.string().uuid();
/** "mom" (the account owner) or a family_members.id. */
const memberId = z.union([z.literal("mom"), uuid]);

const slotAnswer = z.object({
  slot: z.enum(CHECKIN_SLOTS),
  status: z.enum(CHECKIN_STATUSES),
  // A reason only accompanies a deviation; «cooked as planned» carries none.
  reason: z.enum(CHECKIN_REASONS).nullish(),
});

const verdictEntry = z.object({
  member_id: memberId,
  slot: z.enum(CHECKIN_SLOTS),
  recipe_name_ar: z.string().trim().min(1).max(200),
  verdict: z.enum(VERDICTS),
});

const exceptionEntry = z.object({
  member_id: memberId,
  slot: z.enum(CHECKIN_SLOTS),
});

// وزنكِ الخاص — weekly mom weigh-in. Ranges mirror the 00017 DB CHECKs.
export const logBodyWeightSchema = z.object({
  weight_kg: z.number().min(20).max(300),
  waist_cm: z.number().min(30).max(250).nullish(),
});
export type LogBodyWeightInput = z.infer<typeof logBodyWeightSchema>;

// Inline per-meal marking on the plan page. status null = clear the mark
// (a mis-tap must be reversible — honesty over accumulation).
export const setMealCheckinSchema = z.object({
  meal_plan_id: uuid,
  day_index: z.number().int().min(0).max(6),
  slot: z.enum(CHECKIN_SLOTS),
  status: z.enum(CHECKIN_STATUSES).nullable(),
  reason: z.enum(CHECKIN_REASONS).nullish(),
});
export type SetMealCheckinInput = z.infer<typeof setMealCheckinSchema>;

export const closeDayInputSchema = z.object({
  meal_plan_id: uuid,
  day_index: z.number().int().min(0).max(6),
  // One answer per slot; duplicates are a client bug, rejected here.
  slots: z
    .array(slotAnswer)
    .min(1)
    .max(8)
    .refine(
      (arr) => new Set(arr.map((s) => s.slot)).size === arr.length,
      "duplicate slot",
    ),
  verdicts: z.array(verdictEntry).max(40).default([]),
  // Dish-directed member deviations on a cooked shared meal (kind is fixed
  // server-side — the client cannot invent surveillance kinds).
  exceptions: z.array(exceptionEntry).max(20).default([]),
});
export type CloseDayInput = z.infer<typeof closeDayInputSchema>;
