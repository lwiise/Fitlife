/**
 * TEMPORARY testing switch: unlock every paid capability, for everyone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  THIS GIVES THE PRODUCT AWAY. Anyone who can reach the app while it is on
 *     gets every tier's features, unlimited household members, and unlimited
 *     plan generations — without paying and without a subscription row.
 *     It exists so the product can be exercised end-to-end before launch.
 *     TURN IT OFF BEFORE TAKING REAL PAYMENTS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Off unless `NEXT_PUBLIC_FREE_ACCESS_MODE` is exactly "1", so merging this can
 * never change behaviour on its own — enabling it is a deliberate, per-
 * environment act.
 *
 * Why one flag rather than editing each gate: every bypass below is reachable
 * from this single predicate, so turning the product back into a paid product is
 * deleting one environment variable — not remembering which of six checks was
 * loosened months earlier. Grep `isFreeAccessMode` for the complete list of
 * places behaviour changes.
 *
 * Why NEXT_PUBLIC_ for something that is not a secret: the value is needed on
 * both sides — the server for the gates, the client for the on-screen notice
 * that keeps the mode from being forgotten. Next.js inlines it at BUILD time, so
 * toggling it requires a rebuild/redeploy. That is a feature here: the mode
 * cannot be flipped on a live site by editing a runtime variable.
 *
 * What it deliberately does NOT touch:
 *   • The LemonSqueezy checkout + webhook flow, which stays exactly as it is, so
 *     real payments can still be tested while the mode is on.
 *   • The advisor chat's 30-messages-per-day cap. That is abuse/cost protection,
 *     not a paywall; free mode unlocks ACCESS to the chat, not unlimited spend.
 *
 * Cost warning: this removes the weekly plan-generation limits, and every plan
 * generation is a paid Anthropic call. Unlimited generations means unlimited AI
 * spend for as long as the mode is on.
 */

/**
 * Direct property read (not `process.env[key]`) so Next.js can inline the value
 * into the client bundle — a dynamic key stays a runtime lookup and resolves to
 * `undefined` in the browser, which would silently disable the on-screen notice.
 */
export function isFreeAccessMode(): boolean {
  return process.env.NEXT_PUBLIC_FREE_ACCESS_MODE === "1";
}

/** Shown on-screen while the mode is on, so it cannot be quietly forgotten. */
export const FREE_ACCESS_NOTICE_AR = "وضع الاختبار — كل الميزات مفتوحة بلا اشتراك";
