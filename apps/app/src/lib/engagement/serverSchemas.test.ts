import { describe, it, expect } from "vitest";
import {
  logBodyWeightSchema,
  CHILD_WEIGHT_FLOOR_KG,
  OWNER_WEIGHT_FLOOR_KG,
} from "./serverSchemas";

/**
 * 00017 copied the adult profile range (20–300 kg) onto body_logs while the
 * journey was adults-only. Children joined it later (owner directive 07/2026)
 * and the floor never moved, so a child under roughly six could not be weighed
 * at all. 00027 widens the DB CHECK to family_members' 5–300; this schema is
 * its mirror. The owner keeps the adult floor because her scalar mirror
 * (profiles.weight_kg) is still CHECKed at 20.
 */
const CHILD_ID = "0f6f3e9e-9a4c-4d3b-8c31-2b7d9c8e1a55";

describe("logBodyWeightSchema — weight floor per person", () => {
  it("accepts a small child's weight for a family member", () => {
    const r = logBodyWeightSchema.safeParse({ member_id: CHILD_ID, weight_kg: 12 });
    expect(r.success).toBe(true);
  });

  it("accepts exactly the child floor", () => {
    const r = logBodyWeightSchema.safeParse({
      member_id: CHILD_ID,
      weight_kg: CHILD_WEIGHT_FLOOR_KG,
    });
    expect(r.success).toBe(true);
  });

  it("refuses anything under the child floor for anyone", () => {
    expect(
      logBodyWeightSchema.safeParse({ member_id: CHILD_ID, weight_kg: 4 }).success,
    ).toBe(false);
    expect(
      logBodyWeightSchema.safeParse({ member_id: "mom", weight_kg: 4 }).success,
    ).toBe(false);
  });

  it("keeps the adult floor for the account owner", () => {
    expect(
      logBodyWeightSchema.safeParse({ member_id: "mom", weight_kg: 12 }).success,
    ).toBe(false);
    expect(
      logBodyWeightSchema.safeParse({
        member_id: "mom",
        weight_kg: OWNER_WEIGHT_FLOOR_KG,
      }).success,
    ).toBe(true);
  });

  it("defaults member_id to the owner, so a bare payload gets the owner floor", () => {
    expect(logBodyWeightSchema.safeParse({ weight_kg: 12 }).success).toBe(false);
    expect(logBodyWeightSchema.safeParse({ weight_kg: 62.5 }).success).toBe(true);
  });

  it("keeps the shared ceiling", () => {
    expect(
      logBodyWeightSchema.safeParse({ member_id: CHILD_ID, weight_kg: 300 }).success,
    ).toBe(true);
    expect(
      logBodyWeightSchema.safeParse({ member_id: CHILD_ID, weight_kg: 300.5 }).success,
    ).toBe(false);
  });
});
