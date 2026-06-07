import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canGenerateNewPlan,
  canGenerateForFamilyChange,
} from "./access";
import type { SubscriptionRow } from "./state";

// ---------------------------------------------------------------------------
// Mocks
//
// access.ts pulls in three external modules. We mock all three so each test can
// drive a single branch in isolation without touching real Supabase or config:
//
//   ./state                -> getCurrentSubscription / isSubscriptionActive / getTierLimit
//   @/lib/supabase/queries -> canGeneratePlan (the weekly rate-limit check)
//   @/lib/supabase/server  -> createClient (used by the internal countBeneficiaries)
//
// `server-only` is stubbed by vitest.config, so importing access.ts is safe.
// ---------------------------------------------------------------------------

vi.mock("./state", () => ({
  getCurrentSubscription: vi.fn(),
  isSubscriptionActive: vi.fn(),
  getTierLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/queries", () => ({
  canGeneratePlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  getCurrentSubscription,
  isSubscriptionActive,
  getTierLimit,
} from "./state";
import { canGeneratePlan } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

const mockGetCurrentSubscription = vi.mocked(getCurrentSubscription);
const mockIsSubscriptionActive = vi.mocked(isSubscriptionActive);
const mockGetTierLimit = vi.mocked(getTierLimit);
const mockCanGeneratePlan = vi.mocked(canGeneratePlan);
const mockCreateClient = vi.mocked(createClient);

const USER = "user-123";

/** Build a minimal SubscriptionRow; only fields the gating reads matter. */
function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub-1",
    user_id: USER,
    tier: "family",
    status: "active",
    cadence: "monthly",
    trial_started_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    lemonsqueezy_subscription_id: null,
    lemonsqueezy_customer_id: null,
    lemonsqueezy_variant_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as SubscriptionRow;
}

/**
 * Stub the Supabase client used by countBeneficiaries(). The chain
 * .from().select().eq().neq() must resolve to `{ count, error }`.
 * Final beneficiary count returned by countBeneficiaries = count + 1 (Mom).
 */
function stubBeneficiaryCount(count: number, error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // neq is the terminal call that is awaited
    neq: vi.fn().mockResolvedValue({ count, error }),
  };
  mockCreateClient.mockResolvedValue({
    from: vi.fn().mockReturnValue(builder),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults: rate-limit OK, tier limit generous, count low.
  mockCanGeneratePlan.mockResolvedValue(true);
  mockGetTierLimit.mockReturnValue(6);
  stubBeneficiaryCount(0); // -> 1 beneficiary (Mom only)
});

// ===========================================================================
// Subscription state
// ===========================================================================
describe("subscription state gating", () => {
  it("active subscription within period -> allowed", async () => {
    mockGetCurrentSubscription.mockResolvedValue(
      makeSub({
        status: "active",
        current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );
    mockIsSubscriptionActive.mockReturnValue(true);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
  });

  it("trialing and not expired -> allowed", async () => {
    mockGetCurrentSubscription.mockResolvedValue(
      makeSub({
        status: "trialing",
        trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      }),
    );
    mockIsSubscriptionActive.mockReturnValue(true);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
  });

  it("trial expired -> blocked with reason trial_expired", async () => {
    mockGetCurrentSubscription.mockResolvedValue(
      makeSub({
        status: "trialing",
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    );
    mockIsSubscriptionActive.mockReturnValue(false);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("trial_expired");
  });

  it("past_due -> blocked with reason past_due", async () => {
    mockGetCurrentSubscription.mockResolvedValue(
      makeSub({ status: "past_due" }),
    );
    mockIsSubscriptionActive.mockReturnValue(false);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("past_due");
  });

  it("no subscription row -> blocked with reason subscription_inactive", async () => {
    mockGetCurrentSubscription.mockResolvedValue(null);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("subscription_inactive");
  });

  it("inactive non-trial non-pastdue (e.g. cancelled) -> blocked with subscription_inactive", async () => {
    mockGetCurrentSubscription.mockResolvedValue(
      makeSub({ status: "cancelled" as SubscriptionRow["status"] }),
    );
    mockIsSubscriptionActive.mockReturnValue(false);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("subscription_inactive");
  });
});

// ===========================================================================
// Person count vs tier limit
// ===========================================================================
describe("person count vs tier limit", () => {
  beforeEach(() => {
    mockGetCurrentSubscription.mockResolvedValue(makeSub({ status: "active" }));
    mockIsSubscriptionActive.mockReturnValue(true);
  });

  it("beneficiary count exactly at limit -> allowed", async () => {
    mockGetTierLimit.mockReturnValue(4);
    stubBeneficiaryCount(3); // 3 + Mom = 4 == limit

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
  });

  it("beneficiary count below limit -> allowed", async () => {
    mockGetTierLimit.mockReturnValue(6);
    stubBeneficiaryCount(2); // 3 beneficiaries < 6

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
  });

  it("beneficiary count over limit -> blocked person_count_exceeded with details", async () => {
    mockGetTierLimit.mockReturnValue(2);
    stubBeneficiaryCount(4); // 4 + Mom = 5 > 2

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe("person_count_exceeded");
      expect(res.details).toEqual({ current_people: 5, max_people: 2 });
    }
  });

  it("unlimited tier (limit null) -> never blocked on count even with many people", async () => {
    mockGetTierLimit.mockReturnValue(null); // premium / unlimited
    stubBeneficiaryCount(99);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
    // countBeneficiaries should be short-circuited when limit is null.
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Rate limit
// ===========================================================================
describe("weekly rate limit", () => {
  beforeEach(() => {
    mockGetCurrentSubscription.mockResolvedValue(makeSub({ status: "active" }));
    mockIsSubscriptionActive.mockReturnValue(true);
    mockGetTierLimit.mockReturnValue(6);
    stubBeneficiaryCount(0);
  });

  it("canGenerateNewPlan: rate limit available -> allowed", async () => {
    mockCanGeneratePlan.mockResolvedValue(true);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(true);
  });

  it("canGenerateNewPlan: rate limit exhausted -> blocked with reason rate_limit + days_until_reset", async () => {
    mockCanGeneratePlan.mockResolvedValue(false);

    const res = await canGenerateNewPlan(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe("rate_limit");
      expect(res.details).toEqual({ days_until_reset: 7 });
    }
  });

  it("canGenerateForFamilyChange: BYPASSES rate limit (allowed even when exhausted)", async () => {
    mockCanGeneratePlan.mockResolvedValue(false);

    const res = await canGenerateForFamilyChange(USER);
    expect(res.allowed).toBe(true);
    // The rate-limit check must never even be consulted on this path.
    expect(mockCanGeneratePlan).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// canGenerateForFamilyChange still enforces subscription + person count
// ===========================================================================
describe("canGenerateForFamilyChange shared gating", () => {
  it("blocks when subscription inactive", async () => {
    mockGetCurrentSubscription.mockResolvedValue(null);

    const res = await canGenerateForFamilyChange(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("subscription_inactive");
  });

  it("blocks when person count exceeds tier limit", async () => {
    mockGetCurrentSubscription.mockResolvedValue(makeSub({ status: "active" }));
    mockIsSubscriptionActive.mockReturnValue(true);
    mockGetTierLimit.mockReturnValue(1);
    stubBeneficiaryCount(2); // 3 > 1

    const res = await canGenerateForFamilyChange(USER);
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe("person_count_exceeded");
      expect(res.details).toEqual({ current_people: 3, max_people: 1 });
    }
  });

  it("allows when within subscription + count limits", async () => {
    mockGetCurrentSubscription.mockResolvedValue(makeSub({ status: "active" }));
    mockIsSubscriptionActive.mockReturnValue(true);
    mockGetTierLimit.mockReturnValue(6);
    stubBeneficiaryCount(1); // 2 <= 6

    const res = await canGenerateForFamilyChange(USER);
    expect(res.allowed).toBe(true);
  });
});
