/**
 * The timing contract shared by the SERVER's dead-man's switch and the CLIENT's
 * two generating screens (PlanGeneratingState, WorkoutGeneratingState).
 *
 * The rule this module exists to enforce: **a generating screen must never give
 * up before the server can possibly still be working.** It used to, and the
 * result was the customer-visible bug this file is named after — a run that was
 * still lawfully inside its budget was shown «العملية تاخذ وقت أطول من المتوقع»,
 * and refreshing from there just re-rendered the same spinner with a fresh
 * clock, so the screen could cycle forever without ever stating a fact.
 *
 * Both clients used a fixed 13-minute wall clock (`TIMEOUT_MS = 780_000`) whose
 * comment claimed it was "kept inside the background function's 15-min budget".
 * Inside is exactly backwards. The background function's day loop runs until
 * `dayLoopDeadline` (budget − FINALIZE_RESERVE_MS ≈ 14.25 min) and then writes
 * its terminal row inside the reserve, so a healthy run can land at ~15 min —
 * comfortably after a client that quit at 13.
 *
 * This module replaces the wall clock with the only signal that actually means
 * "stuck": the plan row has stopped being written to. Both status routes already
 * return `updated_at`, and `resolveStaleness` (server) reclassifies a silent row
 * at exactly STALE_GENERATION_MIN — so measuring the same silence on the client
 * keeps the two ends in agreement by construction rather than by two numbers
 * somebody has to remember to keep in sync.
 */

/**
 * A 'generating' plan (or a 'ready' shell still flagged generating) whose
 * `updated_at` is older than this is treated as crashed/stale — the background
 * function's hard budget is ~15 min, so past that nothing is still writing.
 *
 * The ONE definition. `staleness.ts` re-exports it for the server; the client
 * imports it from here. It lives in this leaf module rather than in
 * `staleness.ts` because that file pulls `planHasContent` from
 * `@fitlife/plan-engine`, and a client component importing it would drag the
 * engine (prompts and all) into the browser bundle.
 */
export const STALE_GENERATION_MIN = 15;

/**
 * How much later than the server the client is allowed to reach its own verdict.
 *
 * The server's reclassification is the better answer — it distinguishes a
 * partial week worth keeping from a run with nothing to show, and it produces a
 * real screen (the plan, or the retry state) instead of a generic "taking
 * longer" card. So the client deliberately waits a beat past the point where
 * `resolveStaleness` will have settled the row, which means that by the time the
 * client's own fallback can fire, polling itself must be broken — a dead
 * network or an expired session — which is the only case the fallback is really
 * for.
 */
export const SERVER_VERDICT_MARGIN_MS = 60_000;

/**
 * How long a generating screen tolerates NO server-side write before showing its
 * refresh/retry fallback. Derived, never hand-tuned: it is the server's own
 * staleness threshold plus the margin above.
 */
export const GENERATION_SILENCE_LIMIT_MS =
  STALE_GENERATION_MIN * 60_000 + SERVER_VERDICT_MARGIN_MS;

/**
 * How long a plan row may sit with NO invocation ACK from the background worker
 * before we conclude the run never started.
 *
 * This is a much sharper question than "is it stuck", and it deserves a much
 * shorter answer. The worker's ACK is written before any model call — within a
 * second or two of invocation — so its absence after a minute and a half does
 * not mean "slow", it means "nothing is coming". The 15-minute staleness rule
 * cannot tell those apart, which is why a misconfigured worker (a rejected
 * shared secret, a missing key) presented as a quarter-hour blank spinner
 * instead of an error the customer could act on.
 *
 * Generous relative to the thing it measures — a healthy ACK lands ~100x sooner
 * — because the cost of firing early is a false failure on a live run, while the
 * cost of firing late is only a slightly longer wait before a truthful message.
 */
export const WORKER_ACK_LIMIT_MS = 90_000;

/**
 * Age in ms of an ISO timestamp, floored at 0.
 *
 * An absent or unparseable timestamp yields 0 — "written just now", the most
 * generous reading. A stall is a claim about the server having died, so every
 * degraded input must fail toward patience: guessing "old" here would resurrect
 * the very bug this module removes.
 */
export function ageMsFrom(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, now - parsed);
}

/**
 * Whether a run whose last observed server write was at `lastWriteAtMs` (client
 * clock) has gone silent long enough to be called stuck.
 *
 * Both arguments are client-clock instants, so this never compares a server
 * timestamp against a browser one — the caller converts once, at mount, using a
 * server-measured age. That keeps a skewed device clock from either stalling a
 * live run early or hiding a dead one forever.
 */
export function generationHasStalled(lastWriteAtMs: number, now: number): boolean {
  return now - lastWriteAtMs >= GENERATION_SILENCE_LIMIT_MS;
}
