import { describe, it, expect } from "vitest";
import { mealBudgetChanged, resolveRegenDomain } from "./regenDomain";
import { computeEnergyBudget } from "./energyBudget";
import type { EnergyBudget } from "./schema";
import type { EnergyBudgetMember, ExerciseProfile } from "./types";

const budget = (over: Partial<EnergyBudget> = {}): EnergyBudget => ({
  bmr: 1400,
  baseline_maintenance: 1820,
  weekly_eee: 490,
  tdee: 1890,
  target_intake: 1490,
  intensity_mode: "hr_zones",
  intensity_ceiling: "light_moderate",
  clearance_required: false,
  notes: [],
  ...over,
});

describe("mealBudgetChanged", () => {
  it("false when target_intake and clearance are unchanged", () => {
    expect(mealBudgetChanged(budget(), budget())).toBe(false);
  });

  it("true when target_intake changes", () => {
    expect(mealBudgetChanged(budget(), budget({ target_intake: 1600 }))).toBe(true);
  });

  it("true when clearance_required flips", () => {
    expect(mealBudgetChanged(budget(), budget({ clearance_required: true }))).toBe(true);
  });

  it("false when only non-meal fields differ (mode / bmr / eee / tdee)", () => {
    // intensity_mode, bmr, weekly_eee, tdee don't touch the meal math — only the two
    // outputs the meal plan actually consumes matter.
    expect(
      mealBudgetChanged(
        budget(),
        budget({ intensity_mode: "rpe", bmr: 1500, weekly_eee: 700, tdee: 2100 }),
      ),
    ).toBe(false);
  });

  it("false for a child on both sides (null target both ways)", () => {
    const child = budget({ target_intake: null });
    expect(mealBudgetChanged(child, child)).toBe(false);
  });

  it("true when target goes from a value to null (or back)", () => {
    expect(mealBudgetChanged(budget(), budget({ target_intake: null }))).toBe(true);
  });
});

describe("resolveRegenDomain", () => {
  it("promotes exercise → both only when the budget changed", () => {
    expect(resolveRegenDomain("exercise", true)).toEqual({ domain: "both", promoted: true });
    expect(resolveRegenDomain("exercise", false)).toEqual({
      domain: "exercise",
      promoted: false,
    });
  });

  it("passes meals through regardless of budget change", () => {
    expect(resolveRegenDomain("meals", true)).toEqual({ domain: "meals", promoted: false });
    expect(resolveRegenDomain("meals", false)).toEqual({ domain: "meals", promoted: false });
  });

  it("passes both through (never marked promoted)", () => {
    expect(resolveRegenDomain("both", true)).toEqual({ domain: "both", promoted: false });
    expect(resolveRegenDomain("both", false)).toEqual({ domain: "both", promoted: false });
  });
});

// End-to-end of the rule: an input edit → computeEnergyBudget → mealBudgetChanged.
// This is what dispatch's promotion check actually does, so it pins the real product
// behaviour (which edits refresh meals vs. run true exercise-only).
describe("mealBudgetChanged over real profile edits", () => {
  const adult: EnergyBudgetMember = {
    member_type: "adult",
    sex: "female",
    age: 35,
    weight_kg: 70,
    height_cm: 165,
    activity_level: "moderate",
    primary_goal: null, // maintain → target tracks TDEE directly (no clamp masking)
  };
  const base: ExerciseProfile = {
    availability_days: "3-4",
    session_minutes: 30,
    preferred_types: ["walking"],
    equipment: [],
    disliked_types: [],
    screening: {
      intensity_ceiling: "light_moderate",
      clearance_required: false,
      intensity_mode: "hr_zones",
    },
  };
  const b = (p: ExerciseProfile) => computeEnergyBudget(adult, p, p.screening);
  const prev = b(base);
  const changed = (p: ExerciseProfile) => mealBudgetChanged(prev, b(p));

  it("TRUE on more available days", () => {
    expect(changed({ ...base, availability_days: "5+" })).toBe(true);
  });
  it("TRUE on longer sessions", () => {
    expect(changed({ ...base, session_minutes: 45 })).toBe(true);
  });
  it("TRUE on a swapped top preferred type (per-modality MET)", () => {
    expect(changed({ ...base, preferred_types: ["cardio"] })).toBe(true);
  });
  it("TRUE on a raised intensity ceiling", () => {
    expect(
      changed({
        ...base,
        screening: { ...base.screening!, intensity_ceiling: "can_progress_to_vigorous" },
      }),
    ).toBe(true);
  });

  it("FALSE on an intensity-mode flip (hr_zones ↔ rpe)", () => {
    expect(
      changed({ ...base, screening: { ...base.screening!, intensity_mode: "rpe" } }),
    ).toBe(false);
  });
  it("FALSE on an equipment change", () => {
    expect(changed({ ...base, equipment: ["weights"] })).toBe(false);
  });
  it("FALSE on a disliked-type change", () => {
    expect(changed({ ...base, disliked_types: ["yoga_pilates"] })).toBe(false);
  });
  it("FALSE on an MSK-note edit", () => {
    expect(changed({ ...base, msk_notes: "sore left knee" })).toBe(false);
  });
});
