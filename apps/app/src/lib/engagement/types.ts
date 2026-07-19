/**
 * Row types for the 00017 engagement tables.
 *
 * `database.types.ts` is GENERATED (`pnpm --filter @fitlife/app db:types`) and
 * must NOT be hand-edited — these tables land there automatically once 00017
 * is applied and the generator re-runs against the updated schema. Until
 * then, engagement code types its rows against the shapes below (they mirror
 * the migration exactly) and accesses the tables through an untyped client
 * cast, like the export route does.
 *
 * Enum-like fields are TEXT in the DB by house convention — the canonical
 * value sets live here and are enforced with Zod in server actions.
 *
 * SLOT VOCABULARY: extensible by design. A future Ramadan season adds
 * "suhoor" | "iftar" | "ghabga" here + in Zod — no data migration. Do not
 * turn this into a DB CHECK.
 */

// Current slot vocabulary — mirrors the plan JSON's MealSchema slots. A future
// Ramadan season EXTENDS this list ("suhoor" | "iftar" | "ghabga") + Zod; the
// DB column is unconstrained TEXT precisely so that is a config change.
export const CHECKIN_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type CheckinSlot = (typeof CHECKIN_SLOTS)[number];

export const CHECKIN_STATUSES = ["cooked", "swapped", "skipped"] as const;
export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];

// No-shame reason chips («جاءنا ضيوف» is honored, not excused; «طلبنا اليوم»
// is Riyadh reality). Absence of a reason is always valid.
export const CHECKIN_REASONS = [
  "guests",
  "ordered_in",
  "ate_out",
  "missing_ingredients",
  "no_time",
] as const;
export type CheckinReason = (typeof CHECKIN_REASONS)[number];

// Dish-directed by design — child consumption surveillance is unrepresentable.
export const MEMBER_EXCEPTION_KINDS = ["dish_not_suited"] as const;
export type MemberExceptionKind = (typeof MEMBER_EXCEPTION_KINDS)[number];

export const VERDICTS = ["loved", "fine", "not_again"] as const;
export type Verdict = (typeof VERDICTS)[number];

// Workout session status (00020). "moved" is the honest middle — trained, but
// not this exact session; absence of a row is UNKNOWN, never "skipped".
export const WORKOUT_CHECKIN_STATUSES = ["done", "moved", "skipped"] as const;
export type WorkoutCheckinStatus = (typeof WORKOUT_CHECKIN_STATUSES)[number];

/** "mom" for the account owner, otherwise a family_members.id UUID. */
export type EngagementMemberId = string;

/** meal_checkins.member_id sentinel: a row that speaks for the whole house.
 * Pre-00019 rows carry it (they predate per-person status), and the ختام
 * اليوم ritual still writes it on purpose. Readers treat it as a FALLBACK
 * for every member of that meal until a per-member mark supersedes it. */
export const HOUSEHOLD_CHECKIN_MEMBER = "household";

export interface MealCheckinRow {
  id: string;
  user_id: string;
  meal_plan_id: string;
  day_index: number;
  /** Riyadh-local calendar date (YYYY-MM-DD), stamped at write time. */
  local_date: string;
  slot: string;
  /** "mom" | family_members.id — or HOUSEHOLD_CHECKIN_MEMBER (see above).
   * 00019 column: per-person status on shared meals (each person separate). */
  member_id: EngagementMemberId;
  status: CheckinStatus;
  reason: CheckinReason | null;
  created_at: string;
  updated_at: string;
}

export interface MemberExceptionRow {
  id: string;
  user_id: string;
  checkin_id: string;
  member_id: EngagementMemberId;
  kind: MemberExceptionKind;
  created_at: string;
}

export interface MealVerdictRow {
  id: string;
  user_id: string;
  meal_plan_id: string;
  member_id: EngagementMemberId;
  day_index: number;
  slot: string;
  recipe_name_ar: string;
  /** Minted server-side via canonicalRecipeKey() — never in the client. */
  canonical_key: string;
  verdict: Verdict;
  created_at: string;
  updated_at: string;
}

export interface WorkoutCheckinRow {
  id: string;
  user_id: string;
  workout_plan_id: string;
  /** "mom" | family_members.id (plan-JSON convention). */
  member_id: EngagementMemberId;
  /** Weekday-anchored 0..6 (0=Sunday, JS getDay) — matches the workout plan. */
  day_index: number;
  /** Riyadh-local calendar date (YYYY-MM-DD), stamped at write time. */
  local_date: string;
  status: WorkoutCheckinStatus;
  created_at: string;
  updated_at: string;
}

export interface BodyLogRow {
  id: string;
  user_id: string;
  member_id: EngagementMemberId;
  /** YYYY-MM-DD. Unique per (user, member, day) — same-day writes upsert. */
  recorded_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  /** Optional progress photo: object path in the PRIVATE body-photos bucket
   * (`<user_id>/<file>`). Rendered only via short-lived signed URLs on the
   * private journey page — never in messages, share cards, or admin. */
  photo_path: string | null;
  created_at: string;
  updated_at: string;
}

/** Private storage bucket for body progress photos (00018). Path convention:
 * `<user_id>/<file>` — the first folder segment is the RLS owner key, and
 * erasure removes the whole folder. */
export const BODY_PHOTOS_BUCKET = "body-photos";

