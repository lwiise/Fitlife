import { describe, expect, it } from "vitest";

import { getPeriodPair } from "./period";
import {
  computeActivation,
  computeArpu,
  computeEngagement,
  computeLocaleMix,
  computeNrr,
  computePlanFreshness,
  computeQuietPayingWatchlist,
  computeRevenueAtRisk,
  computeRevenueByTier,
  computeTrialWatchlist,
  lastActivityByUser,
  latestSubByUser,
  type SubLike,
} from "./metrics";

const NOW = new Date("2026-06-15T00:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function sub(p: Partial<SubLike> & { user_id: string }): SubLike {
  return {
    status: "active",
    tier: "family",
    cadence: "monthly",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    trial_ends_at: null,
    current_period_end: null,
    cancelled_at: null,
    ...p,
  };
}

describe("computeArpu", () => {
  it("divides MRR by active count", () => {
    const mrr = { mrrSar: 600, arrSar: 7200, mrrUsd: 162, arrUsd: 1944 };
    expect(computeArpu(mrr, 6).arpuSar).toBe(100);
  });
  it("is null with no active subs", () => {
    const mrr = { mrrSar: 0, arrSar: 0, mrrUsd: 0, arrUsd: 0 };
    expect(computeArpu(mrr, 0).arpuSar).toBeNull();
  });
});

describe("computeRevenueAtRisk", () => {
  it("counts expiring trials (within window) + past-due", () => {
    const subs = [
      sub({ user_id: "a", status: "trialing", trial_ends_at: day(5), tier: "family" }),
      sub({ user_id: "b", status: "trialing", trial_ends_at: day(20), tier: "family" }),
      sub({ user_id: "c", status: "past_due", tier: "starter" }),
    ];
    const r = computeRevenueAtRisk(subs, NOW, 7);
    expect(r.count).toBe(2);
    expect(r.trialsMrrSar).toBe(129); // family monthly
    expect(r.pastDueMrrSar).toBe(29); // starter monthly
    expect(r.totalSar).toBe(158);
  });
});

describe("computeTrialWatchlist", () => {
  it("returns expiring trials soonest-first with days left and plan flag", () => {
    const subs = [
      sub({ user_id: "a", status: "trialing", trial_ends_at: day(10) }),
      sub({ user_id: "b", status: "trialing", trial_ends_at: day(3) }),
      sub({ user_id: "c", status: "active" }),
    ];
    const rows = computeTrialWatchlist({
      currentSubs: subs,
      nameByUser: new Map([["a", "A"], ["b", "B"]]),
      emailByUser: new Map(),
      usersWithPlan: new Set(["b"]),
      now: NOW,
      horizonDays: 14,
    });
    expect(rows.map((r) => r.userId)).toEqual(["b", "a"]);
    expect(rows[0]?.daysLeft).toBe(3);
    expect(rows[0]?.planGenerated).toBe(true);
    expect(rows[1]?.planGenerated).toBe(false);
  });
});

describe("computeActivation", () => {
  it("requires onboarding done AND a first plan", () => {
    const profiles = [
      { id: "a", onboarding_completed_at: day(-1) },
      { id: "b", onboarding_completed_at: day(-1) },
      { id: "c", onboarding_completed_at: null },
      { id: "d", onboarding_completed_at: day(-1) },
    ];
    const r = computeActivation(profiles, new Set(["a", "b", "c"]));
    expect(r.activated).toBe(2); // a, b (c has no onboarding; d has no plan)
    expect(r.total).toBe(4);
    expect(r.rate).toBe(50);
  });
});

describe("computeNrr", () => {
  it("approximates retention from the pre-window base minus in-window churn", () => {
    const period = getPeriodPair(30, NOW);
    const subs = [
      sub({ user_id: "a", status: "active" }), // in base, retained
      sub({
        user_id: "b",
        status: "cancelled",
        cancelled_at: "2026-06-01T00:00:00.000Z", // churns inside current window
      }),
    ];
    const nrr = computeNrr(subs, period);
    expect(nrr.value).toBe(50); // 129 retained of 258 base
    expect(nrr.trend.direction).toBe("down");
  });
});

describe("computeRevenueByTier", () => {
  it("splits current MRR across tiers, sorted desc", () => {
    const split = computeRevenueByTier([
      { tier: "family", cadence: "monthly" },
      { tier: "starter", cadence: "monthly" },
      { tier: "starter", cadence: "monthly" },
    ]);
    expect(split[0]?.tier).toBe("family"); // 129 > 58
    expect(split.find((s) => s.tier === "starter")?.count).toBe(2);
  });
});

describe("computePlanFreshness", () => {
  it("counts active households with a recent ready plan", () => {
    const subs = [
      sub({ user_id: "a", status: "active" }),
      sub({ user_id: "b", status: "trialing" }),
      sub({ user_id: "c", status: "cancelled" }),
    ];
    const plans = [
      { user_id: "a", status: "ready", created_at: day(-2), updated_at: day(-2) },
      { user_id: "b", status: "ready", created_at: day(-20), updated_at: day(-20) },
    ];
    const r = computePlanFreshness(subs, plans, NOW, 7);
    expect(r.activeHouseholds).toBe(2); // a + b
    expect(r.freshCount).toBe(1); // only a is within 7 days
    expect(r.rate).toBe(50);
  });
});

describe("computeEngagement", () => {
  it("buckets active-in-7/30 over the base", () => {
    const base = new Set(["a", "b", "c", "d"]);
    const last = lastActivityByUser(
      [{ user_id: "a", created_at: day(-1) }],
      [{ user_id: "b", created_at: day(-10) }],
    );
    const e = computeEngagement({ baseUsers: base, lastActivity: last, now: NOW });
    expect(e.active7).toBe(1); // a
    expect(e.active30).toBe(2); // a + b
    expect(e.base).toBe(4);
  });
});

describe("computeQuietPayingWatchlist", () => {
  it("flags active+idle+renewal-soon, sorted by MRR desc", () => {
    const subs = [
      sub({ user_id: "a", status: "active", tier: "family", current_period_end: day(5) }),
      sub({ user_id: "b", status: "active", tier: "starter", current_period_end: day(5) }),
      sub({ user_id: "c", status: "active", tier: "premium", current_period_end: day(60) }), // renewal far off
    ];
    const last = new Map([["a", day(-30)]]); // a idle, b no activity (idle), c excluded
    const rows = computeQuietPayingWatchlist({
      currentSubs: subs,
      nameByUser: new Map(),
      emailByUser: new Map(),
      lastActivity: last,
      now: NOW,
      idleDays: 14,
      renewalWithinDays: 14,
    });
    expect(rows.map((r) => r.userId)).toEqual(["a", "b"]); // family(129) before starter(29)
  });
});

describe("computeLocaleMix", () => {
  it("tallies user and cook languages", () => {
    const mix = computeLocaleMix(
      [{ preferred_language: "ar" }, { preferred_language: "ar" }, { preferred_language: "en" }],
      [{ preferred_language: "tl" }],
    );
    expect(mix.users[0]?.locale).toBe("ar");
    expect(mix.users[0]?.count).toBe(2);
    expect(mix.cooks[0]?.locale).toBe("tl");
  });
});

describe("latestSubByUser", () => {
  it("keeps the most recent subscription per user", () => {
    const map = latestSubByUser([
      sub({ user_id: "a", created_at: "2026-01-01T00:00:00.000Z", tier: "starter" }),
      sub({ user_id: "a", created_at: "2026-03-01T00:00:00.000Z", tier: "family" }),
    ]);
    expect(map.get("a")?.tier).toBe("family");
  });
});
