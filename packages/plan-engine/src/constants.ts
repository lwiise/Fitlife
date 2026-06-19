/**
 * Anthropic / plan-generation constants.
 *
 * Verify pricing at https://docs.claude.com/en/docs/about-claude/pricing
 * before launch. Locked here as $15/M input, $75/M output for claude-opus-4-7
 * as of 2026-05.
 */

// Defaults to Opus 4.7. Override with the PLAN_MODEL env var (e.g.
// claude-sonnet-4-6 or claude-haiku-4-5-20251001) to test with a faster/cheaper
// model — no code change needed; remove the env var to go back to Opus.
export const PLAN_MODEL = process.env.PLAN_MODEL?.trim() || "claude-opus-4-7";

// ── Tiered (per-phase) models ────────────────────────────────────────────
// Generation has three phases with very different stakes:
//   • Skeleton  — decides each member's calorie/macro TARGETS and plans the week.
//                 For pregnancy/lactation/children/medical conditions this is real
//                 reasoning + a safety surface, and it's tiny in output tokens, so
//                 it stays on the strongest model (PLAN_MODEL).
//   • Day       — expands named dishes into recipes that hit the targets. ~95% of
//                 output tokens but mechanical given names+targets → cheaper/faster
//                 model is the big cost/latency win.
//   • Translate — purely mechanical (Arabic → housekeeper language) → cheapest model.
// Each is independently overridable by env so prod can roll out / revert per phase
// without a code change. Set e.g. PLAN_DAY_MODEL=claude-haiku-4-5-20251001 to drop
// the day phase back to Haiku (cheaper, but it reproducibly fails some member-days).
// Defaults below: skeleton inherits PLAN_MODEL (Opus); the day phase runs on Sonnet
// (strong enough that per-day failures effectively disappear); translate on Haiku.
const HAIKU = "claude-haiku-4-5-20251001";
export const SKELETON_MODEL = process.env.PLAN_SKELETON_MODEL?.trim() || PLAN_MODEL;
export const DAY_MODEL = process.env.PLAN_DAY_MODEL?.trim() || "claude-sonnet-4-6";
export const TRANSLATE_MODEL = process.env.PLAN_TRANSLATE_MODEL?.trim() || HAIKU;

/**
 * Human-readable label for the model(s) a generation used, recorded in the audit
 * rows (plan_generations.model, meal_plans.ai_model). When the skeleton and day
 * phases use the same model it's just that id; otherwise a composite like
 * "claude-sonnet-4-6+claude-haiku-4-5-20251001" so the audit reflects the tiered
 * split. NOTE: this is a display/audit label only — cost_usd is computed per-call
 * from each phase's actual model, never from this string.
 */
export function planModelLabel(): string {
  return SKELETON_MODEL === DAY_MODEL
    ? DAY_MODEL
    : `${SKELETON_MODEL}+${DAY_MODEL}`;
}

// USD per million tokens, keyed by model id. cost_usd in plan_generations is an
// internal audit figure (NOT the SAR price charged to users — that lives in
// packages/config). Verify rates at https://docs.claude.com/en/docs/about-claude/pricing
// before launch. Unknown models fall back to Opus rates (conservative: never
// under-report spend).
export const PRICING_USD_PER_MTOK_BY_MODEL: Record<
  string,
  { input: number; output: number }
> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const FALLBACK_PRICING = { input: 15, output: 75 } as const;

export function pricingForModel(model: string): {
  input: number;
  output: number;
} {
  return PRICING_USD_PER_MTOK_BY_MODEL[model] ?? FALLBACK_PRICING;
}

/**
 * Output-token ceiling for the WHOLE family's weekly plan (single call).
 * A full 7-day plan with rich 8-field recipes can exceed 16k even for a solo
 * member, and multi-member plans definitely do — truncation (stop_reason=
 * max_tokens) was failing generations, so this is 32000. Bump further only if a
 * very large household still truncates.
 */
export const PLAN_MAX_TOKENS = 32000;

// Parallel-by-day generation caps. Phase 1 (skeleton) is names + targets only,
// but it scales with members-in-scope (a fresh full-family run skeletons every
// member, and verbose cases like a child's food-pyramid notes inflate output),
// so 16000 is the FLOOR for small families — generate.ts also retries once at 2x
// if it still truncates. Phase 2 expands one day at a time, in parallel, so
// wall-clock ≈ one day regardless of week/family size.
// DAY_CONCURRENCY caps simultaneous calls to stay under Anthropic rate limits
// (with retry/backoff on 429).
//
// IMPORTANT: SKELETON_MAX_TOKENS / DAY_MAX_TOKENS are FLOORS, not the values
// actually sent. The caps a call uses scale with the members in scope (see the
// helpers below) — a fixed cap truncated large families (a full family-tier run
// is up to 6 people, and independent meal_mode gives each their own recipes), and
// a truncated skeleton fails the WHOLE generation. Raising max_tokens is free
// unless the model actually emits more — it's a ceiling, billed per real token.
export const SKELETON_MAX_TOKENS = 16000;
export const DAY_MAX_TOKENS = 12000;
// Sequential (one day at a time, in order): the plan opens showing all 7 days
// as "loading" and they fill in 1→7. Higher values parallelize (faster total).
// This is the FLOOR concurrency (small families); dayConcurrency() raises it for
// large families so 7 sequential big calls don't blow the 15-min function budget.
export const DAY_CONCURRENCY = 1;

// Hard per-request output ceiling for the plan model. 32000 is already proven safe
// (it was PLAN_MAX_TOKENS, the whole-plan single-call cap). All scaled caps below
// clamp to this so we never request more than the model allows.
export const MAX_OUTPUT_TOKENS = 32000;

/**
 * Skeleton output cap scaled to the members in scope. The skeleton emits, per
 * member, their targets + a full week of dish NAMES (7 days × ~4 slots), so it
 * grows roughly linearly. 6 members → 6000 + 3000·6 = 24000 (vs the old fixed
 * 16000 that truncated and hard-failed the run). Solo stays at the 16000 floor.
 */
export function skeletonMaxTokens(memberCount: number): number {
  return Math.min(
    MAX_OUTPUT_TOKENS,
    Math.max(SKELETON_MAX_TOKENS, 6000 + 3000 * Math.max(1, memberCount)),
  );
}

/**
 * One day's expansion cap scaled to the members missing that day. Each member's
 * day is up to 4 full 8-field recipes; a housekeeper locale roughly doubles
 * per-meal output (translated name + ingredients + steps born in the same call).
 * Worst realistic case — 6 independent eaters + housekeeper translation — lands
 * near the 32000 ceiling; shared families collapse common dishes and sit well
 * under it. Solo (with or without translation) stays at the 12000 floor.
 */
export function dayMaxTokens(memberCount: number, hasTranslation: boolean): number {
  const perMember = hasTranslation ? 4500 : 2600;
  return Math.min(
    MAX_OUTPUT_TOKENS,
    Math.max(DAY_MAX_TOKENS, 3000 + perMember * Math.max(1, memberCount)),
  );
}

/**
 * Wall-clock cap for ONE day/skeleton call, scaled to its size. The default
 * 4-min cap (anthropic.ts) aborts a legitimately large generation mid-stream; a
 * 6-member independent + translation day can emit ~32k tokens and take several
 * minutes. Capped at 10 min, safely under the 15-min function budget that
 * parallel days share.
 */
export function bigCallTimeoutMs(memberCount: number, hasTranslation: boolean): number {
  const perMember = hasTranslation ? 70_000 : 40_000;
  return Math.min(600_000, 240_000 + perMember * Math.max(0, memberCount - 2));
}

/**
 * Day-loop concurrency scaled to the workload. Small families keep the calm
 * ordered 1→7 fill (DAY_CONCURRENCY). Large families make each day's call big and
 * slow; running 7 strictly in sequence would exceed the 15-min function budget,
 * so we parallelize enough to keep total wall-clock ≈ one or two waves. Bounded so
 * we don't fan out an unreasonable number of concurrent heavy calls at once.
 */
// Optional prod override for the large-family parallel day-call cap (no deploy
// needed). Falls back to the tuned defaults below. The ≤3-member sequential
// behavior is unaffected.
const DAY_CONCURRENCY_OVERRIDE = (() => {
  const n = Number(process.env.PLAN_DAY_CONCURRENCY?.trim());
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
})();

export function dayConcurrency(memberCount: number, hasTranslation: boolean): number {
  if (memberCount <= 3) return DAY_CONCURRENCY; // small families: calm sequential 1→7 fill
  // Cap the parallel haiku burst so it stays under the day-model rate limit — 7
  // simultaneous large calls reliably tripped 429s. Override via PLAN_DAY_CONCURRENCY.
  return DAY_CONCURRENCY_OVERRIDE ?? (hasTranslation ? 5 : 4);
}

// Translation (maid/housekeeper) is a separate pass over already-generated meals.
// Strictly sequential (one day at a time, today-first): day 1's recipes fully
// translate and appear, THEN day 2, etc. — never several days landing at once.
// (Parallelizing was faster overall but made the recipes pop in unpredictable
// batches, which read as broken; sequential is the intended UX.)
export const TRANSLATE_CONCURRENCY = 1;

// One-at-a-time member adds: the drain re-runs an incomplete member (a day that
// failed after in-run retries) until it's whole BEFORE starting the next member.
// This caps those completion-retries per member so a deterministically-failing
// day can't block the household forever — after the cap the day shows
// "failed — regenerate" and the drain advances. Counts total runs targeting the
// member (initial attempt + retries).
export const MEMBER_GEN_MAX_ATTEMPTS = 3;
