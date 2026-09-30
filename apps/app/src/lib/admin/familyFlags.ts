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
 *
 * The cancellation rule lives here too (`subscriptionCancelState`): the
 * cancel_scheduled flag, the «cancelling» and «ended» views and every renewal
 * cell read that one function, never the raw status or flag on their own.
 */

import type {
  AttentionReason,
  AttentionSeverity,
  FamilyFlag,
  MealPlanCell,
  SubscriptionCancelState,
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

// ── Cancellation ────────────────────────────────────────────────────────────

/** The subscription fields the cancellation rule reads (a list row and a SubscriptionRow both have them). */
export interface CancelStateInput {
  /** Latest subscription status (null = never subscribed). */
  status: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  endsAt: string | null;
}

/**
 * The statuses LemonSqueezy dates with ends_at: a subscription that has
 * stopped renewing. On any other row (active, trialing, past_due) ends_at is
 * null at the source, so a value there can only be left over — the webhook
 * writes ends_at whenever it is set and never clears it on a renewal payment
 * — and it is never read.
 */
const ENDS_AT_STATUSES: ReadonlySet<string> = new Set(["cancelled", "expired", "paused"]);

/**
 * What a subscription is paid through: its period end, or — when a
 * cancellation arrived without one — LemonSqueezy's ends_at, read only on a
 * row that has stopped renewing. The dates the app judges access by
 * (lib/subscription/state.ts, isSubscriptionActive): an active row by its
 * period end alone, a cancelled one by its period end, else its ends_at.
 */
export function paidThroughAt(
  sub: Pick<CancelStateInput, "status" | "currentPeriodEnd" | "endsAt">,
): string | null {
  if (sub.currentPeriodEnd != null) return sub.currentPeriodEnd;
  return sub.status != null && ENDS_AT_STATUSES.has(sub.status) ? sub.endsAt : null;
}

/**
 * The date a renewal cell shows, a scheduled cancellation is dated at, and
 * the cancellation rule judges: the trial's end while trialing; otherwise
 * what the subscription is paid through (`paidThroughAt`) — its next
 * renewal, or the day a cancelled one runs out.
 */
export function renewalDateAt(
  sub: Pick<CancelStateInput, "status" | "trialEndsAt" | "currentPeriodEnd" | "endsAt">,
): string | null {
  return sub.status === "trialing" ? sub.trialEndsAt : paidThroughAt(sub);
}

/**
 * Where a subscription stands on cancellation. The ONE rule behind the
 * cancel_scheduled flag and its reason, the «cancelling» and «ended» saved
 * views and the renewal cells of the list, the panel and the page.
 *
 * A subscription that will not renew is "scheduled" while it still runs and
 * "ended" after, judged by the date its renewal cell shows (`renewalDateAt`)
 * — so a scheduled cancellation is never shown with a date already passed,
 * with one exception: past_due, below, where the flag alone decides and the
 * date is the renewal that failed (its cancel_scheduled reason is undated):
 *  - 'expired' → ended;
 *  - 'cancelled' → scheduled while the paid-through date is still ahead,
 *    ended once it has passed — or when there is no date at all. Cancelled
 *    means "will not renew", not "access ends now": a cancellation made in
 *    the LemonSqueezy portal lands as status 'cancelled', and the customer
 *    keeps what she paid for until that date;
 *  - cancel_at_period_end on an active or trialing subscription (our own
 *    cancel route keeps the row 'active' and only sets the flag) → scheduled
 *    until the period end, or the trial's end, and ended once it has passed:
 *    a missed expiry webhook leaves the row 'active' after that date. An
 *    active row is dated by its period end alone (a left-over ends_at is not
 *    its date; see `paidThroughAt`). With no date, an active row is a legacy
 *    row with open-ended access (still scheduled) and a trial has already
 *    run out (ended);
 *  - cancel_at_period_end on a past-due subscription → scheduled: its period
 *    end has passed by definition (the renewal failed), so the flag decides;
 *  - anything else → none.
 *
 * It mirrors isSubscriptionActive (lib/subscription/state.ts): outside
 * past_due, "scheduled" is "the app still grants access, and it will not
 * renew" (familyFlags.test.ts holds the two together). It does not call it:
 * that module is server-only, and while free-access mode is on it answers
 * true for everyone, where the console must show the real billing state.
 *
 * `nowMs` is the caller's fixed "now" (the dataset's read time, the page's
 * load time), so every surface judges one snapshot the same way.
 */
export function subscriptionCancelState(
  sub: CancelStateInput,
  nowMs: number,
): SubscriptionCancelState {
  switch (sub.status) {
    case "expired":
      return "ended";
    case "cancelled":
      return runsAt(renewalDateAt(sub), nowMs, false) ? "scheduled" : "ended";
    case "active":
    case "trialing":
      if (!sub.cancelAtPeriodEnd) return "none";
      return runsAt(renewalDateAt(sub), nowMs, sub.status === "active") ? "scheduled" : "ended";
    case "past_due":
      return sub.cancelAtPeriodEnd ? "scheduled" : "none";
    default:
      return "none";
  }
}

/**
 * Does a subscription that runs until `until` still run at `nowMs`? `undated`
 * answers when there is no date. An unparseable date is NaN, which is never
 * ahead: it has run out.
 */
function runsAt(until: string | null, nowMs: number, undated: boolean): boolean {
  return until == null ? undated : Date.parse(until) > nowMs;
}

// ── Runs ────────────────────────────────────────────────────────────────────

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
  /** That subscription's `subscriptionCancelState`, judged at the snapshot's "now". */
  cancelState: SubscriptionCancelState;
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
    cancel_scheduled: input.cancelState === "scheduled",
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
    status: string | null;
    currentPeriodEnd: string | null;
    endsAt: string | null;
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
        // Dated when it takes effect: the day it is paid through (a trial's
        // end). Not on a past-due subscription: its date is the renewal that
        // failed — already behind it, and already the past_due reason's date.
        out.push({
          flag,
          severity: "medium",
          at: sub && sub.status !== "past_due" ? renewalDateAt(sub) : null,
          tab: "billing",
        });
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
