import { planHasContent, type MealPlan } from "@fitlife/plan-engine";

// A 'generating' plan (or a 'ready' shell still flagged generating) whose
// updated_at is older than this is treated as crashed/stale — the background
// function's hard budget is ~15 min, so past that nothing is still writing.
export const STALE_GENERATION_MIN = 15;

export interface StalenessInput {
  status: "generating" | "ready" | "failed";
  planData: MealPlan | null;
  /** meal_plans.updated_at (ISO). Unparseable is treated as infinitely old. */
  updatedAt: string;
  errorMessage: string | null;
  now?: number;
}

export interface StalenessResult {
  status: "generating" | "ready" | "failed";
  planData: MealPlan | null;
  inProgress: boolean;
  errorMessage: string | null;
}

/**
 * Decide what a possibly-dead generation should look like to the UI.
 *
 * Extracted from getLatestPlan (which is `server-only` and therefore awkward to
 * test) so the rule below can be pinned by tests.
 *
 * The dead-man's switch itself is unchanged: a run the background function never
 * finished leaves the row 'generating', or a 'ready' shell still flagged
 * generating, and nothing sweeps it — so past STALE_GENERATION_MIN with no write
 * we stop believing it.
 *
 * What changed is what happens NEXT, and it matters commercially. This used to
 * null `plan_data` unconditionally, so a household whose run was killed at 4 of
 * 7 days lost all four — days the customer had waited for and the business had
 * already paid Anthropic to produce — and the retry re-spent the whole budget.
 * A partial plan is now KEPT and surfaced as ready-but-incomplete, which is
 * exactly the state DeferredMemberDrain (app/plan/page.tsx) needs in order to
 * re-dispatch and fill the missing days. Only a plan with no meals at all still
 * degrades to `failed`, because there is genuinely nothing to show and nothing
 * for the drain to build on.
 */
export function resolveStaleness(input: StalenessInput): StalenessResult {
  const { status, planData, updatedAt, errorMessage } = input;
  const now = input.now ?? Date.now();

  const updatedMs = Date.parse(updatedAt);
  const ageMin = Number.isNaN(updatedMs) ? Infinity : (now - updatedMs) / 60_000;

  // A 'ready' shell that never filled in any meals (worker died after the flip,
  // or every day failed) is empty — treat it as in-flight so the same staleness
  // gate can reclassify it once nothing is writing.
  const hasContent = !!planData && planHasContent(planData);
  const planEmpty = status === "ready" && !hasContent;
  const stillInFlight =
    status === "generating" ||
    (status === "ready" && planData?.generating === true) ||
    planEmpty;

  if (!stillInFlight || ageMin < STALE_GENERATION_MIN) {
    return {
      status,
      planData,
      inProgress: planData?.generating === true,
      errorMessage,
    };
  }

  if (hasContent && planData) {
    // Keep the days we have. `generating` is cleared in the returned copy so the
    // viewer stops spinning on days that will never arrive in THIS run — the
    // drain's own dispatch sets it again when the next one starts.
    console.warn("[getLatestPlan] stale in-flight plan with content; keeping partial week");
    return {
      status: "ready",
      planData: { ...planData, generating: false },
      inProgress: false,
      errorMessage,
    };
  }

  console.warn("[getLatestPlan] stale in-flight plan with no content; surfacing as failed");
  return {
    status: "failed",
    planData: null,
    inProgress: false,
    // Say what actually happened. This used to fall back to the very sentence
    // the failure screen already shows as its body copy, so «تفاصيل تقنية»
    // expanded to a verbatim repeat and told a stuck user nothing — the state
    // this branch exists to explain is precisely the one with no other signal
    // (the worker never wrote a row, so there is no engine message to show).
    errorMessage:
      errorMessage ??
      `توقّف التحضير قبل أن تكتمل أي وجبة — مضى أكثر من ${STALE_GENERATION_MIN} دقيقة دون أي تحديث من مولّد الخطة.`,
  };
}
