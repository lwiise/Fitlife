import { describe, expect, it } from "vitest";
import type { FamilyRow } from "@/lib/admin/console-types";
import { fmtMoney } from "@/lib/admin/format";
import { fmtDay, fmtRelativeTo } from "../_blocks/helpers";
import { familyRowText, familyRowTexts, rowTextFormatter } from "./rowText";

function fam(p: Partial<FamilyRow> = {}): FamilyRow {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    displayName: "هند",
    email: "hind@example.com",
    tier: "family",
    status: "active",
    cadence: "monthly",
    signupAt: "2026-06-01T09:00:00Z",
    trialEndsAt: "2026-06-08T09:00:00Z",
    currentPeriodEnd: "2026-10-01T09:00:00Z",
    cancelAtPeriodEnd: false,
    beneficiaries: 2,
    hasHousekeeper: false,
    overLimit: false,
    plansGenerated: 1,
    failedPlans: 0,
    lastActivityAt: "2026-09-27T09:00:00Z",
    lifetimeAiCostUsd: 3.28,
    onboardingComplete: true,
    meal: { state: "ready", daysReady: 7, daysTotal: 7, masked: false },
    workout: { state: "none", masked: false },
    flags: [],
    ...p,
  };
}

const NOW = "2026-09-30T09:00:00Z";

describe("familyRowText", () => {
  it("formats cost, signup, last activity and the renewal date once, for the request", () => {
    const text = familyRowText(fam(), { locale: "ar", currency: "sar", nowIso: NOW });
    expect(text.cost).toBe(fmtMoney(3.28, "sar", "ar", 2));
    expect(text.signup).toBe(fmtDay("2026-06-01T09:00:00Z", "ar"));
    expect(text.last).toBe("قبل ٣ أيام");
    expect(text.lastDay).toBe(fmtDay("2026-09-27T09:00:00Z", "ar"));
    // Not trialing: the period end.
    expect(text.renewal).toBe(fmtDay("2026-10-01T09:00:00Z", "ar"));
  });

  it("follows the operator's currency and language", () => {
    const text = familyRowText(fam(), { locale: "en", currency: "usd", nowIso: NOW });
    expect(text.cost).toBe(fmtMoney(3.28, "usd", "en", 2));
    expect(text.last).toBe("3 days ago");
  });

  it("uses the trial end while trialing", () => {
    const text = familyRowText(fam({ status: "trialing" }), { locale: "en", currency: "sar", nowIso: NOW });
    expect(text.renewal).toBe(fmtDay("2026-06-08T09:00:00Z", "en"));
  });

  it("leaves what is not there empty rather than inventing it", () => {
    const text = familyRowText(
      fam({ lifetimeAiCostUsd: 0, lastActivityAt: null, currentPeriodEnd: null, status: null }),
      { locale: "ar", currency: "sar", nowIso: NOW },
    );
    expect(text.cost).toBeNull();
    expect(text.last).toBeNull();
    expect(text.lastDay).toBeNull();
    expect(text.renewal).toBe("—");
  });

  it("keys every row's strings by family id", () => {
    const a = fam({ userId: "00000000-0000-4000-8000-00000000000a" });
    const b = fam({ userId: "00000000-0000-4000-8000-00000000000b", lifetimeAiCostUsd: 0 });
    const texts = familyRowTexts([a, b], { locale: "ar", currency: "sar", nowIso: NOW });
    expect(Object.keys(texts).sort()).toEqual([a.userId, b.userId]);
    expect(texts[b.userId]?.cost).toBeNull();
  });
});

/**
 * The formatters are built once per call for speed; their output must stay
 * the shared helpers' exactly (the same text as the panel and the family
 * page). Timestamps near Riyadh midnight, plain calendar days, every
 * relative-time step, odd costs and unusable values are all compared.
 */
describe("rowTextFormatter matches the shared helpers", () => {
  const instants = [
    "2026-09-30T08:59:59Z",
    "2026-09-30T08:30:00Z",
    "2026-09-30T06:00:00Z",
    "2026-09-29T21:30:00Z", // after midnight in Riyadh — the next day there
    "2026-09-29T20:59:00Z",
    "2026-09-28T09:00:00Z",
    "2026-09-01T00:00:00Z",
    "2026-07-15T12:00:00Z",
    "2025-12-31T22:00:00Z",
    "2024-02-29T10:00:00Z",
    "2026-10-05T09:00:00Z", // the future
    "2026-10-01", // a plain calendar day
    "not a date",
  ];
  const costs = [0.0001, 0.004, 0.005, 1, 1.005, 3.28, 12.5, 1234.567, 98765.4321];

  for (const locale of ["ar", "en"] as const) {
    for (const currency of ["sar", "usd"] as const) {
      it(`${locale} · ${currency}`, () => {
        const format = rowTextFormatter({ locale, currency, nowIso: NOW });
        for (const iso of instants) {
          for (const status of ["active", "trialing"] as const) {
            const text = format(
              fam({
                status,
                signupAt: iso,
                lastActivityAt: iso,
                trialEndsAt: iso,
                currentPeriodEnd: iso,
              }),
            );
            expect(text.signup).toBe(fmtDay(iso, locale));
            expect(text.renewal).toBe(fmtDay(iso, locale));
            expect(text.last).toBe(fmtRelativeTo(iso, NOW, locale));
            expect(text.lastDay).toBe(fmtDay(iso, locale));
          }
        }
        for (const cost of costs) {
          expect(format(fam({ lifetimeAiCostUsd: cost })).cost).toBe(fmtMoney(cost, currency, locale, 2));
        }
        // An unusable "now" falls back to the plain day, as fmtRelativeTo does.
        const lost = rowTextFormatter({ locale, currency, nowIso: "garbage" });
        expect(lost(fam()).last).toBe(fmtRelativeTo("2026-09-27T09:00:00Z", "garbage", locale));
      });
    }
  }
});
