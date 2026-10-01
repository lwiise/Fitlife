import { describe, expect, it } from "vitest";
import type { FamilyRow } from "@/lib/admin/console-types";
import { packFamilyRow, packFamilyRows, unpackFamilyRow, unpackFamilyRows } from "./rowCodec";

/** Every field set, none at a default, so a dropped or swapped field shows. */
const FULL: FamilyRow = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "هند العتيبي",
  email: "hind@example.com",
  tier: "family",
  status: "past_due",
  cadence: "annual",
  signupAt: "2026-06-01T08:00:00.000Z",
  trialEndsAt: "2026-06-08",
  currentPeriodEnd: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-20T00:00:00Z",
  cancelAtPeriodEnd: true,
  beneficiaries: 5,
  hasHousekeeper: true,
  overLimit: true,
  plansGenerated: 12,
  failedPlans: 3,
  lastActivityAt: "2026-09-29T10:00:00Z",
  lifetimeAiCostUsd: 12.3456,
  onboardingComplete: false,
  meal: { state: "generating", daysReady: 4, daysTotal: 7, masked: true },
  workout: { state: "failed", masked: true },
  flags: ["past_due", "over_limit", "failed_workout_run"],
  cancelState: "scheduled",
};

const SPARSE: FamilyRow = {
  ...FULL,
  userId: "00000000-0000-4000-8000-000000000002",
  displayName: null,
  email: null,
  tier: null,
  status: null,
  cadence: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  endsAt: null,
  cancelAtPeriodEnd: false,
  hasHousekeeper: false,
  overLimit: false,
  lastActivityAt: null,
  lifetimeAiCostUsd: 0,
  onboardingComplete: true,
  meal: { state: "none", daysReady: null, daysTotal: 7, masked: false },
  workout: { state: "none", masked: false },
  flags: [],
  cancelState: "none",
};

describe("rowCodec", () => {
  it("carries every field of a row, unchanged, through a JSON round trip", () => {
    for (const row of [FULL, SPARSE]) {
      const wire = JSON.parse(JSON.stringify(packFamilyRow(row))) as ReturnType<typeof packFamilyRow>;
      const back = unpackFamilyRow(wire);
      expect(back).toEqual(row);
      expect(Object.keys(back).sort()).toEqual(Object.keys(row).sort());
    }
    expect(unpackFamilyRows(packFamilyRows([FULL, SPARSE]))).toEqual([FULL, SPARSE]);
  });

  it("sends the field names once, not once per family", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...FULL,
      userId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    const packed = JSON.stringify(packFamilyRows(rows));
    expect(packed).not.toContain("displayName");
    expect(packed).not.toContain("lifetimeAiCostUsd");
    // Under half the bytes of the rows as objects.
    expect(packed.length).toBeLessThan(JSON.stringify(rows).length / 2);
  });
});
