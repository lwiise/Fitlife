/**
 * Generation failure classification. Pure + testable, and free of `server-only`
 * so both the overview (action queue) and insights (failures-by-cause) can use
 * it without dragging in the data-loading module.
 *
 * Failures are stored as free text (`error_message` / `failure_reason`), so we
 * bucket them with ordered heuristics — most specific first.
 */

export type FailureCause =
  | "max_tokens"
  | "timeout"
  | "rate_limit"
  | "validation"
  | "api_error"
  | "unknown";

export interface FailureBucket {
  cause: FailureCause;
  count: number;
}

/**
 * Map a free-text error to a coarse cause. `max_tokens` also covers the
 * "household too large → response truncated" class, which we expect to be the
 * dominant systemic failure.
 */
export function classifyFailure(text: string | null | undefined): FailureCause {
  if (!text) return "unknown";
  const m = text.toLowerCase();
  if (/(max_tokens|maxtokens|truncat|too large|too long|token limit|context length)/.test(m))
    return "max_tokens";
  if (/(timeout|timed out|deadline|aborted|etimedout)/.test(m)) return "timeout";
  if (/(rate.?limit|429|overloaded|too many requests|quota)/.test(m)) return "rate_limit";
  if (/(zod|schema|validation|invalid|parse|unexpected token|malformed)/.test(m))
    return "validation";
  if (/(api|anthropic|5\d\d|network|fetch|econn|socket|upstream)/.test(m))
    return "api_error";
  return "unknown";
}

/** Count failed generations by cause, most-common first. */
export function computeFailureBuckets(
  gens: Array<{ status: string; error_message: string | null; failure_reason: string | null }>,
): FailureBucket[] {
  const counts = new Map<FailureCause, number>();
  for (const g of gens) {
    if (g.status !== "failed") continue;
    const cause = classifyFailure(g.error_message ?? g.failure_reason);
    counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);
}
