import { planHasContent, type MealPlan } from "@fitlife/plan-engine";

// The threshold now lives in the leaf module `generationTiming.ts` so the two
// client generating screens can measure the SAME silence without importing this
// file (which pulls in the plan engine). Re-exported here because this module's
// existing consumers — getLatestPlan, getLatestWorkoutPlan — import it from the
// staleness contract, and that is the right place for them to read it.
export { STALE_GENERATION_MIN } from "./generationTiming";

import { STALE_GENERATION_MIN, WORKER_ACK_LIMIT_MS } from "./generationTiming";

export interface StalenessInput {
  status: "generating" | "ready" | "failed";
  planData: MealPlan | null;
  /** meal_plans.updated_at (ISO). Unparseable is treated as infinitely old. */
  updatedAt: string;
  errorMessage: string | null;
  /**
   * Whether the background worker wrote its invocation ACK (`worker_ack_at` in
   * plan_data) for this row. False means we have no evidence the worker ever
   * ran — which, past WORKER_ACK_LIMIT_MS, is the difference between a slow run
   * and a run that was never going to happen.
   *
   * Defaults to TRUE when omitted, which is deliberate: rows created before the
   * ACK existed carry no marker, and treating those as "never started" would
   * retroactively fail every in-flight plan on the deploy that ships this.
   */
  workerAcked?: boolean;
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

  // The worker never acknowledged the invocation.
  //
  // This runs ABOVE the staleness branch because it answers a sharper question
  // far sooner. A run that was refused before it began — rejected shared secret,
  // missing key, a body the handler rejected — returns before the only code that
  // terminalizes the row, and Netlify's pre-handler 202 hides that from the
  // dispatcher. Without this rule such an account is indistinguishable from a
  // healthy slow run for a full fifteen minutes, and then reports the mushy
  // «تاخذ وقت أطول من المتوقع» rather than the truth, which is that nothing ever
  // started. `workerAcked` defaults true, so this can only ever fire for rows
  // that genuinely carry no ACK.
  const ackMissing = input.workerAcked === false;
  if (
    status === "generating" &&
    !hasContent &&
    ackMissing &&
    now - updatedMs >= WORKER_ACK_LIMIT_MS
  ) {
    console.warn("[getLatestPlan] no worker ACK; run never started");
    return {
      status: "failed",
      planData: null,
      inProgress: false,
      errorMessage:
        errorMessage ?? "لم تبدأ عملية إنشاء الخطة. حاولي مرة ثانية.",
    };
  }

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
    errorMessage: errorMessage ?? "تعذّر إكمال إنشاء الخطة. يرجى المحاولة مرة أخرى.",
  };
}
