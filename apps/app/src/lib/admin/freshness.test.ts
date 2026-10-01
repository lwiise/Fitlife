import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_DATASET_TTL_SECONDS,
  ADMIN_HOUSEHOLD_CACHE_TAGS,
  maxServedAgeMs,
  readWithinMaxAge,
  servable,
  shouldQuietRefresh,
  snapshotAgeMs,
} from "./freshness";

const NOW = Date.parse("2026-10-01T09:00:00Z");
const secAgo = (s: number) => new Date(NOW - s * 1000).toISOString();
const TTL = ADMIN_DATASET_TTL_SECONDS;

describe("servable", () => {
  it("serves a cached snapshot until it is two TTLs old, and never after", () => {
    expect(maxServedAgeMs(TTL)).toBe(2 * TTL * 1000);
    expect(servable(secAgo(0), TTL, NOW)).toBe(true);
    // Past the TTL: unstable_cache is refreshing it in the background.
    expect(servable(secAgo(TTL + 30), TTL, NOW)).toBe(true);
    expect(servable(secAgo(2 * TTL), TTL, NOW)).toBe(true);
    expect(servable(secAgo(2 * TTL + 1), TTL, NOW)).toBe(false);
    // The first load after a quiet night.
    expect(servable(secAgo(10 * 3600), TTL, NOW)).toBe(false);
  });

  it("never trusts a snapshot that cannot say when it was read", () => {
    for (const loadedAt of [null, undefined, "", "yesterday"]) {
      expect(snapshotAgeMs(loadedAt, NOW)).toBe(Infinity);
      expect(servable(loadedAt, TTL, NOW)).toBe(false);
    }
  });
});

describe("readWithinMaxAge", () => {
  it("serves the cached entry while it may be served, without reading", async () => {
    const fresh = vi.fn(async () => ({ loadedAt: secAgo(0), v: "fresh" }));
    const got = await readWithinMaxAge(
      async () => ({ loadedAt: secAgo(90), v: "cached" }),
      fresh,
      TTL,
      () => NOW,
    );
    expect(got.v).toBe("cached");
    expect(fresh).not.toHaveBeenCalled();
  });

  it("reads for itself when the cached entry is too old to serve", async () => {
    const fresh = vi.fn(async () => ({ loadedAt: secAgo(0), v: "fresh" }));
    const got = await readWithinMaxAge(
      async () => ({ loadedAt: secAgo(3 * 3600), v: "cached" }),
      fresh,
      TTL,
      () => NOW,
    );
    expect(got.v).toBe("fresh");
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});

describe("shouldQuietRefresh", () => {
  const ttlMs = TTL * 1000;

  it("asks once the list's data is older than the TTL", () => {
    const base = { sinceRenderMs: 0, sinceLastAttemptMs: Infinity };
    expect(shouldQuietRefresh({ ...base, ageAtRenderMs: 5_000 })).toBe(false);
    expect(shouldQuietRefresh({ ...base, ageAtRenderMs: ttlMs + 1 })).toBe(true);
    // Fresh when rendered, old by the time the operator comes back.
    expect(shouldQuietRefresh({ ...base, ageAtRenderMs: 5_000, sinceRenderMs: ttlMs })).toBe(true);
  });

  it("asks at most once a TTL", () => {
    const old = { ageAtRenderMs: 10 * ttlMs, sinceRenderMs: 0 };
    expect(shouldQuietRefresh({ ...old, sinceLastAttemptMs: 2_000 })).toBe(false);
    expect(shouldQuietRefresh({ ...old, sinceLastAttemptMs: ttlMs + 1 })).toBe(true);
  });

  it("never loops on a time it cannot read", () => {
    expect(
      shouldQuietRefresh({ ageAtRenderMs: Number.NaN, sinceRenderMs: 0, sinceLastAttemptMs: Infinity }),
    ).toBe(false);
  });
});

describe("ADMIN_HOUSEHOLD_CACHE_TAGS", () => {
  it("names every cached read an erased household can linger in", () => {
    expect([...ADMIN_HOUSEHOLD_CACHE_TAGS].sort()).toEqual([
      "admin-dataset",
      "admin-email-map",
      "admin-engagement",
    ]);
  });
});
