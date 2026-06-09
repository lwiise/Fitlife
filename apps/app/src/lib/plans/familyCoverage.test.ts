import { describe, it, expect } from "vitest";
import { shouldRegenerateFamilyOnActivation } from "./familyCoverage";

describe("shouldRegenerateFamilyOnActivation", () => {
  it("does NOT trigger for a trial / non-paid subscription", () => {
    // family of 5, no plan yet, but no paid sub → trial gives mom-only via the
    // explicit skip path, never an auto whole-family regen.
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: false,
        planMemberCount: 0,
        beneficiaryCount: 5,
        tierMaxPeople: 1,
      }),
    ).toBe(false);
  });

  it("triggers when a covering paid tier has more beneficiaries than the plan", () => {
    // skipped → mom-only plan (1), then subscribed to family (max 6), 5 beneficiaries.
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: true,
        planMemberCount: 1,
        beneficiaryCount: 5,
        tierMaxPeople: 6,
      }),
    ).toBe(true);
  });

  it("triggers on a fresh subscribe with no plan yet", () => {
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: true,
        planMemberCount: 0,
        beneficiaryCount: 4,
        tierMaxPeople: null, // unlimited
      }),
    ).toBe(true);
  });

  it("does NOT trigger when the plan already covers everyone the tier allows", () => {
    // family of 5 but tier only covers 2; plan already has those 2 → no re-loop.
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: true,
        planMemberCount: 2,
        beneficiaryCount: 5,
        tierMaxPeople: 2,
      }),
    ).toBe(false);
  });

  it("does NOT trigger when the whole family is already in the plan", () => {
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: true,
        planMemberCount: 5,
        beneficiaryCount: 5,
        tierMaxPeople: null,
      }),
    ).toBe(false);
  });

  it("does NOT re-trigger a paid solo user (1 beneficiary already planned)", () => {
    expect(
      shouldRegenerateFamilyOnActivation({
        isPaidActive: true,
        planMemberCount: 1,
        beneficiaryCount: 1,
        tierMaxPeople: 6,
      }),
    ).toBe(false);
  });
});
