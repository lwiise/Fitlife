import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The single most important assertion in this file is that the mode is OFF by
 * default. Everything else is a convenience; that one is what stops the product
 * being given away because a flag was misspelled, half-set, or truthy-ish.
 *
 * Modules are re-imported per test because `isFreeAccessMode` reads
 * `process.env` at call time and the subscription modules capture it via import.
 */

const FLAG = "NEXT_PUBLIC_FREE_ACCESS_MODE";

afterEach(() => {
  delete process.env[FLAG];
  vi.resetModules();
});

async function loadFreeAccess() {
  vi.resetModules();
  return import("./freeAccess");
}

async function loadState() {
  vi.resetModules();
  return import("./state");
}

describe("isFreeAccessMode", () => {
  it("is OFF when the variable is unset", async () => {
    delete process.env[FLAG];
    const { isFreeAccessMode } = await loadFreeAccess();
    expect(isFreeAccessMode()).toBe(false);
  });

  it("is ON only for exactly \"1\"", async () => {
    process.env[FLAG] = "1";
    const { isFreeAccessMode } = await loadFreeAccess();
    expect(isFreeAccessMode()).toBe(true);
  });

  it("is OFF for every other truthy-looking value", async () => {
    // A half-set flag must fail CLOSED. "true"/"yes"/"0"/"" are the values most
    // likely to be typed by hand into a dashboard, and none of them may unlock
    // the product.
    for (const value of ["true", "TRUE", "yes", "on", "0", "", " 1", "1 ", "01"]) {
      process.env[FLAG] = value;
      const { isFreeAccessMode } = await loadFreeAccess();
      expect(isFreeAccessMode(), `value ${JSON.stringify(value)} must not enable free access`).toBe(
        false,
      );
    }
  });
});

describe("subscription gates under free access", () => {
  const expiredTrial = {
    id: "s1",
    user_id: "u1",
    tier: "starter",
    status: "trialing",
    cadence: null,
    trial_started_at: "2020-01-01T00:00:00.000Z",
    // Long past — normally this locks the account out entirely.
    trial_ends_at: "2020-01-08T00:00:00.000Z",
    current_period_start: null,
    current_period_end: null,
    ends_at: null,
    cancel_at_period_end: false,
    lemonsqueezy_subscription_id: null,
    lemonsqueezy_customer_id: null,
    lemonsqueezy_variant_id: null,
    created_at: "2020-01-01T00:00:00.000Z",
    updated_at: "2020-01-01T00:00:00.000Z",
  } as unknown as import("./state").SubscriptionRow;

  it("leaves an expired trial locked when the mode is off", async () => {
    delete process.env[FLAG];
    const { isSubscriptionActive } = await loadState();
    expect(isSubscriptionActive(expiredTrial)).toBe(false);
  });

  it("unlocks an expired trial when the mode is on", async () => {
    process.env[FLAG] = "1";
    const { isSubscriptionActive } = await loadState();
    expect(isSubscriptionActive(expiredTrial)).toBe(true);
  });

  it("keeps the real tier limits when the mode is off", async () => {
    delete process.env[FLAG];
    const { getTierLimit } = await loadState();
    expect(getTierLimit("starter")).toBe(1);
    expect(getTierLimit("family")).toBe(6);
    // premium is genuinely unlimited in the pricing config.
    expect(getTierLimit("premium")).toBeNull();
  });

  it("makes every tier unlimited when the mode is on", async () => {
    process.env[FLAG] = "1";
    const { getTierLimit } = await loadState();
    for (const tier of ["starter", "pro", "family", "premium"] as const) {
      expect(getTierLimit(tier), `${tier} must be unlimited in free mode`).toBeNull();
    }
  });

  it("still refuses a fresh checkout only when a live LS subscription exists", async () => {
    // Free mode makes isSubscriptionActive() true for everything, so this guard
    // could have started blocking checkout for trial users — it must not, since
    // the payment flow has to stay testable while the mode is on.
    process.env[FLAG] = "1";
    const { hasLiveLemonsqueezySubscription } = await loadState();
    expect(hasLiveLemonsqueezySubscription(expiredTrial)).toBe(false);
    expect(hasLiveLemonsqueezySubscription(null)).toBe(false);
  });
});
