import { describe, it, expect } from "vitest";
import {
  hasLiveLemonsqueezySubscription,
  type SubscriptionRow,
} from "./state";

/**
 * Guard predicate for /api/checkout: a user with a LIVE Lemonsqueezy
 * subscription must not reach a second checkout (double-billing / orphaned
 * LS sub). Trial users (no LS id) and lapsed/cancelled/expired subs must
 * still be allowed through.
 */

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

function makeSub(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: "sub-row-1",
    user_id: "user-1",
    tier: "family",
    status: "active",
    cadence: "monthly",
    trial_started_at: null,
    trial_ends_at: null,
    current_period_start: PAST,
    current_period_end: FUTURE,
    cancel_at_period_end: false,
    lemonsqueezy_subscription_id: "ls-123",
    lemonsqueezy_customer_id: "cus-123",
    lemonsqueezy_variant_id: "var-123",
    created_at: PAST,
    updated_at: PAST,
    ...overrides,
  };
}

describe("hasLiveLemonsqueezySubscription", () => {
  it("blocks an active subscription with an LS id", () => {
    expect(hasLiveLemonsqueezySubscription(makeSub({}))).toBe(true);
  });

  it("blocks a paid trial (trialing WITH an LS id)", () => {
    const sub = makeSub({ status: "trialing", trial_ends_at: FUTURE });
    expect(hasLiveLemonsqueezySubscription(sub)).toBe(true);
  });

  it("blocks past_due (LS sub recoverable by paying)", () => {
    const sub = makeSub({ status: "past_due" });
    expect(hasLiveLemonsqueezySubscription(sub)).toBe(true);
  });

  it("allows when there is no subscription row", () => {
    expect(hasLiveLemonsqueezySubscription(null)).toBe(false);
  });

  it("allows an internal trial (no LS id)", () => {
    const sub = makeSub({
      status: "trialing",
      trial_ends_at: FUTURE,
      lemonsqueezy_subscription_id: null,
    });
    expect(hasLiveLemonsqueezySubscription(sub)).toBe(false);
  });

  it("allows cancelled and expired subs even with an LS id", () => {
    expect(hasLiveLemonsqueezySubscription(makeSub({ status: "cancelled" }))).toBe(false);
    expect(hasLiveLemonsqueezySubscription(makeSub({ status: "expired" }))).toBe(false);
  });

  it("allows an 'active' row whose paid period has lapsed", () => {
    const sub = makeSub({ current_period_end: PAST });
    expect(hasLiveLemonsqueezySubscription(sub)).toBe(false);
  });
});
