import { describe, expect, it } from "vitest";
import {
  assertDeletableTestAccount,
  assertSafeTarget,
  assertSandboxVariant,
  findLiveModeVariantDrift,
  hostOf,
  isKnownProductionHost,
  isLocalHost,
  isTestAccountEmail,
  SANDBOX_VARIANT_IDS,
} from "./guards.js";
import { PRICING_TIERS } from "./pricingConfig.js";

describe("target safety", () => {
  it("allows a local app", () => {
    expect(() => assertSafeTarget("http://localhost:3001", [], "app URL")).not.toThrow();
    expect(() => assertSafeTarget("http://127.0.0.1:54321", [], "db")).not.toThrow();
  });

  it("refuses an unknown remote host by default", () => {
    expect(() => assertSafeTarget("https://staging.example.com", [], "app URL")).toThrow(
      /Refusing to run/,
    );
  });

  it("allows a remote host only when explicitly opted in", () => {
    expect(() =>
      assertSafeTarget("https://staging.example.com", ["staging.example.com"], "app URL"),
    ).not.toThrow();
  });

  it("refuses production even when it is on the allow-list", () => {
    expect(() =>
      assertSafeTarget(
        "https://fitlife-app-mvp.netlify.app",
        ["fitlife-app-mvp.netlify.app"],
        "app URL",
      ),
    ).toThrow(/production/i);
  });

  it("rejects a malformed URL rather than guessing", () => {
    expect(() => assertSafeTarget("not-a-url", [], "app URL")).toThrow(/not a valid URL/);
  });

  it("identifies hosts", () => {
    expect(hostOf("https://Example.COM:8080/x")).toBe("example.com:8080");
    expect(isLocalHost("http://localhost:3001")).toBe(true);
    expect(isLocalHost("https://example.com")).toBe(false);
    expect(isKnownProductionHost("https://fitlife-app-mvp.netlify.app/pricing")).toBe(true);
  });
});

describe("sandbox variant safety", () => {
  it("accepts the family monthly test variant", () => {
    expect(() =>
      assertSandboxVariant(PRICING_TIERS.family.lemonsqueezy_variant_id_monthly),
    ).not.toThrow();
  });

  it("refuses an id that is not a known test variant", () => {
    expect(() => assertSandboxVariant("999999")).toThrow(/not in the known TEST-MODE/);
  });

  it("reports no drift while pricing.ts still holds test-mode ids", () => {
    // This is the tripwire for the pre-launch live-variant swap that pricing.ts
    // documents as pending. When it fires, the E2E suite must be re-pointed
    // before it is allowed to create checkouts again.
    expect(findLiveModeVariantDrift()).toEqual([]);
  });

  it("covers every tier and cadence in the pricing config", () => {
    const configured = Object.values(PRICING_TIERS).flatMap((t) => [
      t.lemonsqueezy_variant_id_monthly,
      t.lemonsqueezy_variant_id_annual,
    ]);
    expect([...SANDBOX_VARIANT_IDS].sort()).toEqual([...configured].sort());
  });
});

describe("deletion safety", () => {
  it("allows a suite-issued address", () => {
    expect(() =>
      assertDeletableTestAccount("e2e-journey-abc@e2e.fitlife.invalid", "id-1"),
    ).not.toThrow();
  });

  it("refuses anything else", () => {
    for (const email of [
      "customer@gmail.com",
      "hmhstudio.sa@gmail.com",
      null,
      undefined,
      "",
      "spoof@e2e.fitlife.invalid.evil.com",
    ]) {
      expect(() => assertDeletableTestAccount(email, "id-1")).toThrow(/Refusing to delete/);
    }
  });

  it("recognises suite addresses case-insensitively", () => {
    expect(isTestAccountEmail("E2E-X@E2E.FITLIFE.INVALID")).toBe(true);
    expect(isTestAccountEmail("someone@example.com")).toBe(false);
  });
});
