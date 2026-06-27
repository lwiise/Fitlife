import { describe, it, expect } from "vitest";
import { computeEnergyBudget, computeHrZones, rpeForBand } from "./energyBudget";
import type { EnergyBudgetMember, ExerciseProfile } from "./types";

const adult = (over: Partial<EnergyBudgetMember> = {}): EnergyBudgetMember => ({
  member_type: "adult",
  sex: "female",
  age: 35,
  weight_kg: 70,
  height_cm: 165,
  activity_level: "moderate",
  primary_goal: "body_recomposition",
  ...over,
});

describe("computeEnergyBudget", () => {
  it("null profile → today's meal TDEE (graceful degradation)", () => {
    // BMR = 10*70 + 6.25*165 - 5*35 - 161 = 1395.25 ; ×1.55 (moderate) = 2162.64
    const b = computeEnergyBudget(adult(), null);
    expect(b.bmr).toBe(1395);
    expect(b.weekly_eee).toBe(0);
    expect(b.tdee).toBe(2163);
    expect(b.target_intake).toBe(2163); // recomp → maintenance
  });

  it("fat-loss applies a deficit when it stays above the floor", () => {
    // age30 wt60 ht160 light: BMR 1289 ×1.375 = 1772.375 ; −400 = 1372.375 (floor 1289)
    const b = computeEnergyBudget(
      adult({ age: 30, weight_kg: 60, height_cm: 160, activity_level: "light", primary_goal: "fat_loss" }),
      null,
    );
    expect(b.target_intake).toBe(1372);
    expect(b.notes.some((n) => n.includes("clamped"))).toBe(false);
  });

  it("Rule 2: deficit is clamped at the floor (here BMR > medical min)", () => {
    // age25 wt90 ht175 sedentary: BMR 1707.75 ×1.2 = 2049.3 ; −400 = 1649.3 < BMR → 1708
    const b = computeEnergyBudget(
      adult({ age: 25, weight_kg: 90, height_cm: 175, activity_level: "sedentary", primary_goal: "fat_loss" }),
      null,
    );
    expect(b.target_intake).toBe(1708);
    expect(b.notes.some((n) => n.includes("clamped"))).toBe(true);
  });

  it("Rule 2: deficit clamped at the medical minimum (1200)", () => {
    // age60 wt50 ht150 sedentary: BMR 976.5 ×1.2 = 1171.8 ; −400 = 771.8 → floor 1200
    const b = computeEnergyBudget(
      adult({ age: 60, weight_kg: 50, height_cm: 150, activity_level: "sedentary", primary_goal: "fat_loss" }),
      null,
    );
    expect(b.target_intake).toBe(1200);
  });

  it("Rule 3: pregnant → no deficit even with a weight-loss goal", () => {
    // BMR 1370.25 ×1.375 = 1884.09 ; +340 (trimester 2) = 2224
    const b = computeEnergyBudget(
      adult({ member_type: "pregnant", age: 30, weight_kg: 65, activity_level: "light", primary_goal: "fat_loss", trimester: 2 }),
      null,
    );
    expect(b.target_intake).toBe(2224);
    expect(b.target_intake!).toBeGreaterThan(b.tdee); // surplus, never a deficit
    expect(b.notes.some((n) => n.includes("pregnant"))).toBe(true);
  });

  it("Rule 3: lactating → maintenance + a lactation increment", () => {
    // age32 wt68 ht167 moderate: BMR 1402.75 ×1.55 = 2174.26 ; +500 (≤6mo) = 2674
    const b = computeEnergyBudget(
      adult({ member_type: "lactating", age: 32, weight_kg: 68, height_cm: 167, months_postpartum: 3 }),
      null,
    );
    expect(b.target_intake).toBe(2674);
    expect(b.target_intake!).toBeGreaterThan(b.tdee);
    expect(b.notes.some((n) => n.includes("lactating"))).toBe(true);
  });

  it("Rule 4: child → no calorie target, no EEE", () => {
    const b = computeEnergyBudget(
      adult({ member_type: "child", age: 8, weight_kg: 28, height_cm: 130, sex: "male", primary_goal: null }),
      { child_activities: "كرة قدم", screening: null },
    );
    expect(b.target_intake).toBeNull();
    expect(b.weekly_eee).toBe(0);
  });

  it("intensity_mode comes from the screening verdict (hr_meds → rpe)", () => {
    const profile: ExerciseProfile = {
      availability_days: "3-4",
      session_minutes: 30,
      preferred_types: ["walking"],
      hr_meds: true,
      screening: { intensity_ceiling: "light_moderate", clearance_required: false, intensity_mode: "rpe" },
    };
    const b = computeEnergyBudget(adult({ age: 45 }), profile);
    expect(b.intensity_mode).toBe("rpe");
    // walking→walking; EEE = 4 × MET(walking,moderate)=3.5 × 70kg × 0.5h = 490
    expect(b.weekly_eee).toBe(490);
  });

  it("Rule 1: opted-in maintenance intake equals the weekly-averaged TDEE (no per-day spike)", () => {
    const profile: ExerciseProfile = {
      availability_days: "5+",
      session_minutes: 45,
      preferred_types: ["cardio"],
      screening: { intensity_ceiling: "can_progress_to_vigorous", clearance_required: false, intensity_mode: "hr_zones" },
    };
    const b = computeEnergyBudget(
      adult({ sex: "male", age: 30, weight_kg: 80, height_cm: 180, primary_goal: "body_recomposition" }),
      profile,
    );
    // cardio→cycling; EEE = 5 × MET(cycling,vigorous)=9.5 × 80kg × 0.75h = 2850
    expect(b.weekly_eee).toBe(2850);
    // intake is the single weekly-stable value = the (EEE-averaged) TDEE itself
    expect(b.target_intake).toBe(b.tdee);
  });
});

describe("intensity helpers", () => {
  it("computeHrZones uses Karvonen %HRR", () => {
    // rest 60, age 40 → HRmax 180, HRR 120; moderate = 60 + [0.40,0.59]×120 = 108–131
    const zones = computeHrZones(60, 40);
    const mod = zones.find((z) => z.band === "moderate")!;
    expect(mod.low_bpm).toBe(108);
    expect(mod.high_bpm).toBe(131);
  });

  it("rpeForBand maps to Borg targets", () => {
    expect(rpeForBand("moderate")).toEqual({ low: 12, high: 13 });
    expect(rpeForBand("vigorous")).toEqual({ low: 14, high: 17 });
  });
});

describe("computeEnergyBudget — decided refinements", () => {
  it("Rule 3: energy-availability floor keeps net intake ≥ BMR for an active fat-loss member", () => {
    const profile: ExerciseProfile = {
      availability_days: "3-4",
      session_minutes: 30,
      preferred_types: ["cardio"],
      screening: { intensity_ceiling: "can_progress_to_vigorous", clearance_required: false, intensity_mode: "hr_zones" },
    };
    // BMR(35,60,162,F)=1276.5; EEE = 4×MET(cycling,vig)=9.5×60×0.5 = 1140
    // deficit would land at TDEE−400 = 1422 < EA floor (BMR + 1140/7 = 1439) → clamped
    const b = computeEnergyBudget(
      adult({ age: 35, weight_kg: 60, height_cm: 162, primary_goal: "fat_loss" }),
      profile,
    );
    expect(b.weekly_eee).toBe(1140);
    expect(b.target_intake).toBe(1439);
    // net intake after weekly-averaged EEE is held at ~BMR (±rounding)
    expect(Math.abs(b.target_intake! - b.weekly_eee / 7 - b.bmr)).toBeLessThan(2);
    expect(b.notes.some((n) => n.includes("energy-availability floor"))).toBe(true);
  });

  it("clearance_required passes through from the screening verdict", () => {
    const profile: ExerciseProfile = {
      availability_days: "1-2",
      session_minutes: 15,
      preferred_types: ["walking"],
      screening: { intensity_ceiling: "light_moderate", clearance_required: true, intensity_mode: "rpe" },
    };
    expect(computeEnergyBudget(adult(), profile).clearance_required).toBe(true);
    expect(computeEnergyBudget(adult(), null).clearance_required).toBe(false);
  });

  it("Rule 1: more prescribed activity raises the (single, weekly) maintenance target — fueled, not a ledger", () => {
    const base = adult({ sex: "male", age: 30, weight_kg: 80, height_cm: 180, primary_goal: "body_recomposition" });
    const light: ExerciseProfile = {
      availability_days: "1-2", session_minutes: 15, preferred_types: ["walking"],
      screening: { intensity_ceiling: "light_moderate", clearance_required: false, intensity_mode: "hr_zones" },
    };
    const heavy: ExerciseProfile = {
      availability_days: "5+", session_minutes: 45, preferred_types: ["cardio"],
      screening: { intensity_ceiling: "can_progress_to_vigorous", clearance_required: false, intensity_mode: "hr_zones" },
    };
    const a = computeEnergyBudget(base, light);
    const z = computeEnergyBudget(base, heavy);
    expect(z.weekly_eee).toBeGreaterThan(a.weekly_eee);
    expect(z.target_intake!).toBeGreaterThan(a.target_intake!); // fueled accordingly
    expect(typeof z.target_intake).toBe("number"); // one weekly scalar, no per-day field
    expect(z.target_intake).toBe(z.tdee); // maintenance = weekly TDEE
  });
});
