/**
 * Why a family needs an operator's attention — the flags on a families-list
 * row and the sentences the side panel and family page build from them. Pure
 * and client-safe (type-only imports).
 *
 * One derivation for every surface: the list row, the panel header and the
 * family page header all get their flags from `deriveFamilyFlags` (the header
 * literally builds its row with the list's own builder), so a family can never
 * be "clean" in the list and flagged on its page.
 *
 * The medical gate is deliberately NOT a list flag — the list is the
 * least-privileged surface and never says who has a medical condition. It
 * joins the reasons only where the caller passes it (panel and page).
 */

import type {
  AttentionReason,
  AttentionSeverity,
  FamilyFlag,
  MealPlanCell,
  WorkoutPlanCell,
} from "./console-types";

/** Most severe first — the order flags are stored and shown in. */
export const FAMILY_FLAG_ORDER: readonly FamilyFlag[] = [
  "past_due",
  "over_limit",
  "failed_workout_run",
  "failed_meal_run",
  "cancel_scheduled",
  "onboarding_incomplete",
];

/** A subscription still running, for which a scheduled cancellation matters. */
export function isLiveForCancellation(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export type GenerationKind = "meal" | "workout";

/** plan_generations.plan_kind → kind. Missing/unknown values are meal runs (00014's default). */
export function generationKind(planKind: string | null | undefined): GenerationKind {
  return planKind === "workout" ? "workout" : "meal";
}

export interface GenerationLike {
  plan_kind?: string | null;
  status: string;
  created_at: string;
}

/**
 * The newest generation row of each kind (by created_at). A failure followed
 * by a completed run of the same kind is history, not a problem — but the
 * audit row is only half of a kind's run flag; see `deriveFamilyFlags`.
 */
export function newestGenerationByKind<G extends GenerationLike>(
  gens: readonly G[],
): { meal: G | null; workout: G | null } {
  let meal: G | null = null;
  let workout: G | null = null;
  let mealMs = -Infinity;
  let workoutMs = -Infinity;
  for (const g of gens) {
    const ms = Date.parse(g.created_at);
    const t = Number.isNaN(ms) ? -Infinity : ms;
    if (generationKind(g.plan_kind) === "workout") {
      if (workout === null || t > workoutMs) {
        workout = g;
        workoutMs = t;
      }
    } else if (meal === null || t > mealMs) {
      meal = g;
      mealMs = t;
    }
  }
  return { meal, workout };
}

/** The part of a plan cell the run flags read. */
export type ServedCellLike = Pick<MealPlanCell | WorkoutPlanCell, "state" | "masked">;

export interface FlagInput {
  /** Latest subscription status (null = never subscribed). */
  status: string | null;
  cancelAtPeriodEnd: boolean;
  overLimit: boolean;
  onboardingComplete: boolean;
  /** Status of the newest meal-kind generation row, if any. */
  newestMealRunStatus: string | null;
  /** Status of the newest workout-kind generation row, if any. */
  newestWorkoutRunStatus: string | null;
  /** What the household is served (the list's meal / exercise cells). */
  meal: ServedCellLike;
  workout: ServedCellLike;
}

/**
 * The served plan failed: the newest run died with nothing to show, whether
 * or not an older plan is shown in its place.
 */
export function servedCellFailed(cell: ServedCellLike): boolean {
  return cell.state === "failed" || cell.masked;
}

/**
 * The list flags, most severe first.
 *
 * A kind's run flag is set when its newest generation row failed OR its served
 * cell failed / is masked. The audit row alone misses two common failures,
 * which would leave a red or masked cell with no flag behind it:
 *  - a hard-killed WORKOUT run leaves its row 'started' for good (the sweeper
 *    is meal-only; only the next workout dispatch reclassifies it), while the
 *    program cell already reads failed by staleness;
 *  - a housekeeper translation after a failed MEAL run writes its own audit
 *    row with the column default plan_kind 'meal' and closes it 'completed',
 *    so the newest meal row no longer says failed while the cell is masked.
 * The audit-row half still matters on its own: a failed run next to a plan
 * that is fine (a failed translation or top-up) stays a low-severity flag.
 */
export function deriveFamilyFlags(input: FlagInput): FamilyFlag[] {
  const on: Record<FamilyFlag, boolean> = {
    past_due: input.status === "past_due",
    over_limit: input.overLimit,
    failed_workout_run:
      input.newestWorkoutRunStatus === "failed" || servedCellFailed(input.workout),
    failed_meal_run: input.newestMealRunStatus === "failed" || servedCellFailed(input.meal),
    cancel_scheduled: input.cancelAtPeriodEnd && isLiveForCancellation(input.status),
    onboarding_incomplete: !input.onboardingComplete,
  };
  return FAMILY_FLAG_ORDER.filter((f) => on[f]);
}

/**
 * When a kind's failure started, for its attention reason: the newest run's
 * start when that run failed; otherwise, when the flag comes from the served
 * cell (a killed run still 'started', or a failure hidden behind a later
 * translation row), the newest plan row's creation — the failing plan.
 */
export function runFailureAt(
  newestRun: { status: string; created_at: string } | null,
  cell: ServedCellLike,
  newestPlanCreatedAt: string | null,
): string | null {
  if (newestRun?.status === "failed") return newestRun.created_at;
  return servedCellFailed(cell) ? newestPlanCreatedAt : null;
}

export interface ReasonInput {
  flags: readonly FamilyFlag[];
  /** Panel/page only. */
  medicalGateBlocked: boolean;
  subscription: {
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    updatedAt: string | null;
  } | null;
  beneficiaries: number;
  maxPeople: number | null;
  /** When the failing run started (the newest run of that kind). */
  mealFailureAt: string | null;
  workoutFailureAt: string | null;
  /** What the household is served now — sets how urgent a failed run is. */
  meal: MealPlanCell;
  workout: WorkoutPlanCell;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };

/** The order reasons appear in within one severity. */
const REASON_ORDER: ReadonlyArray<AttentionReason["flag"]> = [
  "past_due",
  "over_limit",
  "medical_gate",
  "failed_workout_run",
  "failed_meal_run",
  "cancel_scheduled",
  "onboarding_incomplete",
];

/**
 * How much a failed run matters depends on what the family still has:
 * nothing to show → high; an older plan served in its place → medium; a plan
 * that is fine despite the failed run (a failed translation or top-up run) →
 * low.
 */
function failedRunSeverity(cell: { state: string; masked: boolean }): AttentionSeverity {
  if (cell.masked) return "medium";
  return cell.state === "ready" ? "low" : "high";
}

/** Each flag as a reason with its severity, date and the tab that resolves it. */
export function attentionReasons(input: ReasonInput): AttentionReason[] {
  const out: AttentionReason[] = [];
  const sub = input.subscription;
  for (const flag of input.flags) {
    switch (flag) {
      case "past_due":
        out.push({
          flag,
          severity: "high",
          at: sub?.currentPeriodEnd ?? sub?.updatedAt ?? null,
          tab: "billing",
        });
        break;
      case "over_limit":
        out.push({
          flag,
          severity: "high",
          at: null,
          tab: "household",
          people: input.beneficiaries,
          maxPeople: input.maxPeople,
        });
        break;
      case "failed_workout_run":
        out.push({
          flag,
          severity: failedRunSeverity(input.workout),
          at: input.workoutFailureAt,
          tab: "exercise",
        });
        break;
      case "failed_meal_run":
        out.push({
          flag,
          severity: failedRunSeverity(input.meal),
          at: input.mealFailureAt,
          tab: "meal",
        });
        break;
      case "cancel_scheduled":
        out.push({ flag, severity: "medium", at: sub?.currentPeriodEnd ?? null, tab: "billing" });
        break;
      case "onboarding_incomplete":
        out.push({ flag, severity: "medium", at: sub?.trialEndsAt ?? null, tab: "summary" });
        break;
    }
  }
  if (input.medicalGateBlocked) {
    out.push({ flag: "medical_gate", severity: "high", at: null, tab: "household" });
  }
  return out.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      REASON_ORDER.indexOf(a.flag) - REASON_ORDER.indexOf(b.flag),
  );
}
