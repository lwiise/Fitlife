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
 * Output-token ceiling for ONE beneficiary's weekly plan (7 days of meals in
 * token-dense Arabic JSON). The full family plan is generated as one concurrent
 * call per member, so each response stays well under this; 6000 is comfortable
 * headroom for a single person's week.
 */
export const PLAN_MEMBER_MAX_TOKENS = 6000;
