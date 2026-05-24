/**
 * Anthropic / plan-generation constants.
 *
 * Verify pricing at https://docs.claude.com/en/docs/about-claude/pricing
 * before launch. Locked here as $15/M input, $75/M output for claude-opus-4-7
 * as of 2026-05.
 */

export const PLAN_MODEL = "claude-opus-4-7";

export const PRICING_USD_PER_MTOK = {
  input: 15,
  output: 75,
} as const;

/**
 * Output-token ceiling for the WHOLE family's weekly plan (single call).
 * Sara's family-as-unit writes each shared recipe once with compact per-member
 * portions, so the full plan fits comfortably; 16000 gives rich plans room to
 * finish. If a large household (5-6) truncates (stop_reason=max_tokens), bump
 * to 32000.
 */
export const PLAN_MAX_TOKENS = 16000;
