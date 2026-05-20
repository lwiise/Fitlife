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
 * token-dense Arabic JSON). A full member week (4 meals × 7 days with recipes,
 * ingredients, prep steps, macros) genuinely runs ~7–9k tokens, so 6000 cut it
 * off mid-plan. This is a ceiling, not a target — the model stops naturally at
 * the plan's real length; 16000 just gives complete plans room to finish.
 */
export const PLAN_MEMBER_MAX_TOKENS = 16000;
