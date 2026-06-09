import { describe, expect, it } from "vitest";

import { buildActionQueue } from "./actionQueue";
import type { QuietPayingRow, TrialWatchRow } from "./metrics";

function trial(p: Partial<TrialWatchRow> & { userId: string; daysLeft: number }): TrialWatchRow {
  return {
    name: "T",
    email: null,
    tier: "family",
    trialEndsAt: "2026-06-20T00:00:00.000Z",
    planGenerated: false,
    ...p,
  };
}

function quiet(p: Partial<QuietPayingRow> & { userId: string }): QuietPayingRow {
  return {
    name: "Q",
    email: null,
    tier: "family",
    lastActivityAt: null,
    renewalAt: "2026-06-20T00:00:00.000Z",
    mrrSar: 129,
    ...p,
  };
}

describe("buildActionQueue", () => {
  it("orders high-severity first (past_due, urgent trials, big failure buckets), then medium", () => {
    const items = buildActionQueue({
      pastDue: [{ userId: "pd", name: "PD" }],
      trials: [trial({ userId: "t-urgent", daysLeft: 2 }), trial({ userId: "t-soon", daysLeft: 6 })],
      quiet: [quiet({ userId: "q1" })],
      failureBuckets: [
        { cause: "max_tokens", count: 6 },
        { cause: "timeout", count: 1 },
      ],
    });
    const kinds = items.map((i) => i.kind);
    // high: past_due, trial_expiring(2d), systemic_failures(6) — then medium: trial(6d), quiet
    expect(kinds.slice(0, 3).sort()).toEqual(
      ["past_due", "systemic_failures", "trial_expiring"].sort(),
    );
    expect(items[0]?.kind).toBe("past_due"); // kind rank tiebreak within high
    expect(kinds[kinds.length - 1]).toBe("quiet_high_value");
  });

  it("drops failure buckets below the threshold and trials beyond 7 days", () => {
    const items = buildActionQueue({
      pastDue: [],
      trials: [trial({ userId: "far", daysLeft: 12 })],
      quiet: [],
      failureBuckets: [{ cause: "timeout", count: 2 }],
    });
    expect(items).toHaveLength(0);
  });

  it("marks failure buckets high only at 2× the threshold", () => {
    const items = buildActionQueue({
      pastDue: [],
      trials: [],
      quiet: [],
      failureBuckets: [{ cause: "max_tokens", count: 3 }],
    });
    expect(items[0]?.severity).toBe("medium");
    expect(items[0]?.detail).toBe("max_tokens");
  });
});
