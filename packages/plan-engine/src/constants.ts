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

export const PRICING_USD_PER_MTOK = {
  input: 15,
  output: 75,
} as const;

/**
 * Output-token ceiling for the WHOLE family's weekly plan (single call).
 * A full 7-day plan with rich 8-field recipes can exceed 16k even for a solo
 * member, and multi-member plans definitely do — truncation (stop_reason=
 * max_tokens) was failing generations, so this is 32000. Bump further only if a
 * very large household still truncates.
 */
export const PLAN_MAX_TOKENS = 32000;
