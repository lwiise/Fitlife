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

// Parallel-by-day generation caps. Phase 1 (skeleton) is names + targets only
// (small). Phase 2 expands one day at a time, in parallel, so wall-clock ≈ one
// day regardless of week/family size. DAY_CONCURRENCY caps simultaneous calls to
// stay under Anthropic rate limits (with retry/backoff on 429).
export const SKELETON_MAX_TOKENS = 6000;
export const DAY_MAX_TOKENS = 12000;
// Sequential (one day at a time, in order): the plan opens showing all 7 days
// as "loading" and they fill in 1→7. Higher values parallelize (faster total).
export const DAY_CONCURRENCY = 1;

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
