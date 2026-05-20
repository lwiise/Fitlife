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
 * Output-token ceiling for a full-week plan covering up to ~6 family members.
 * A complete plan (members × 7 days × meals, Arabic JSON which is token-dense)
 * exceeds 8000 tokens and truncates mid-string → invalid JSON. Raised to 32000
 * (Opus 4.7's standard max output) to fit the largest households. Generation
 * runs in a Netlify background function (15-min budget), so output size — not
 * request timeout — is the only constraint here.
 */
export const PLAN_MAX_TOKENS = 32000;
