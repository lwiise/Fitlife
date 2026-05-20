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
 * Generous ceiling for a full-week plan covering up to ~6 family members.
 * Generation runs in a Netlify background function (15-min budget), so output
 * size — not request timeout — is the only constraint here.
 */
export const PLAN_MAX_TOKENS = 8000;
