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

/** "mom" for the account owner, otherwise a family_members.id UUID. */
export type EngagementMemberId = string;

export interface MealCheckinRow {
  id: string;
  user_id: string;
  meal_plan_id: string;
  day_index: number;
  /** Riyadh-local calendar date (YYYY-MM-DD), stamped at write time. */
  local_date: string;
  slot: string;
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

export interface BodyLogRow {
  id: string;
  user_id: string;
  member_id: EngagementMemberId;
  /** YYYY-MM-DD. Unique per (user, member, day) — same-day writes upsert. */
  recorded_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  created_at: string;
  updated_at: string;
}
