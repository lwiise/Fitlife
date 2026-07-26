/**
 * QA (temporary): proves the three "no way out" states a real signup can reach.
 * Each test replicates the exact client-side gate the UI uses, then runs the
 * REAL engine gate against what that client would have persisted.
 */
import { describe, it, expect } from "vitest";
import {
  buildPlanContext,
  buildSkeletonPrompt,
  buildDayPrompt,
  MedicalGateError,
} from "@fitlife/plan-engine";
import { fakeSupabase, baseProfile } from "./personaHarness";
import { hasGateCondition } from "@/lib/plans/medicalConditions";

/** MomWizard.doctorNeeded — verbatim. */
function momWizardDoctorNeeded(o: {
  conditions: string[];
  otherCondition: string;
  isMale: boolean;
  pregStatus: string;
  highRisk: boolean | null;
}) {
  return (
    o.conditions.length > 0 ||
    o.otherCondition.trim().length > 0 ||
    (!o.isMale && o.pregStatus === "pregnant" && o.highRisk === true)
  );
}

/** HealthEditForm.doctorNeeded (/profile/health) — verbatim. */
function healthFormDoctorNeeded(o: {
  conditions: string[];
  otherCondition: string;
  pregStatus: string;
  highRisk: boolean | null;
}) {
  return (
    hasGateCondition(o.conditions) ||
    o.otherCondition.trim().length > 0 ||
    (o.pregStatus === "pregnant" && o.highRisk === true)
  );
}

/** saveMomHealthInfo's save-time gate — verbatim. */
function healthSaveBlocked(o: {
  conditions: string[];
  isPregnant: boolean;
  highRisk: boolean;
  consultedDoctor: boolean;
}) {
  return (
    (hasGateCondition(o.conditions) || (o.isPregnant && o.highRisk)) &&
    !o.consultedDoctor
  );
}

async function gateOf(profile: Record<string, unknown>) {
  try {
    await buildPlanContext(
      fakeSupabase({ email: "x", label: "x", profile, members: [] }),
      "mom",
    );
    return "ok" as const;
  } catch (err) {
    return err instanceof MedicalGateError ? ("blocked" as const) : ("other" as const);
  }
}

describe("DEAD END 1 — pregnant, low-risk account owner", () => {
  it("the wizard never asks for the doctor confirmation", () => {
    expect(
      momWizardDoctorNeeded({
        conditions: [],
        otherCondition: "",
        isMale: false,
        pregStatus: "pregnant",
        highRisk: false,
      }),
    ).toBe(false);
  });

  it("so consulted_doctor=false is stored, and the engine blocks every generation", async () => {
    const stored = baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 5,
      pregnancy_trimester: 2,
      high_risk_pregnancy: false,
      consulted_doctor: false,
    });
    expect(await gateOf(stored)).toBe("blocked");
  });

  it("and /profile/health ALSO hides the checkbox → she can never unblock herself", () => {
    expect(
      healthFormDoctorNeeded({
        conditions: [],
        otherCondition: "",
        pregStatus: "pregnant",
        highRisk: false,
      }),
    ).toBe(false);
  });

  it("confirming the doctor is the ONLY fix", async () => {
    const fixed = baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 5,
      high_risk_pregnancy: false,
      consulted_doctor: true,
    });
    expect(await gateOf(fixed)).toBe("ok");
  });
});

describe("DEAD END 2 — adding a STABLE condition from /profile/health", () => {
  const conditions = ["anemia"]; // فقر الدم — a STABLE_CONDITIONS entry

  it("the edit form hides the doctor checkbox for a stable condition", () => {
    expect(
      healthFormDoctorNeeded({ conditions, otherCondition: "", pregStatus: "none", highRisk: null }),
    ).toBe(false);
  });

  it("and the save-time gate lets it through with consulted_doctor=false", () => {
    expect(
      healthSaveBlocked({ conditions, isPregnant: false, highRisk: false, consultedDoctor: false }),
    ).toBe(false);
  });

  it("but the engine's gate fires on ANY condition → generation blocked forever", async () => {
    const stored = baseProfile({
      medical_conditions: conditions,
      has_medical_conditions: true,
      consulted_doctor: false,
    });
    expect(await gateOf(stored)).toBe("blocked");
  });
});

describe("DEAD END 3 — under-18 account owner is planned as an adult", () => {
  it("engine assembly says child, but the prompts say adult", async () => {
    const minor = baseProfile({
      birth_year: 2012, // 14 in 2026
      height_cm: 158,
      weight_kg: 50,
      member_type: "adult",
      primary_goal: "fat_loss",
    });
    const ctx = await buildPlanContext(
      fakeSupabase({ email: "x", label: "x", profile: minor, members: [] }),
      "mom",
    );
    expect(ctx.mom.age).toBe(new Date().getFullYear() - 2012);

    // The skeleton roster gets NO child clause for the owner (members do).
    const skeleton = buildSkeletonPrompt(ctx);
    const hasChildClause = skeleton.includes("حصص الهرم الغذائي");
    console.log("[minor owner] skeleton contains the child-portions clause:", hasChildClause);

    // The day prompt hands her an adult calorie target.
    const day = buildDayPrompt(
      ctx,
      {
        safety_disclaimer_ar: "x",
        members: [
          {
            member_id: "mom",
            daily_calories_target: 1900,
            macros_target: { protein_g: 130, carbs_g: 190, fat_g: 60 },
            days: [
              {
                day_index: 0,
                day_name_ar: "الأحد",
                meals: [{ slot: "breakfast", slot_name_ar: "فطور", recipe_name_ar: "شوفان" }],
              },
            ],
          },
        ],
      } as never,
      0,
    );
    const adultTarget = day.includes("الهدف: 1900 سعرة");
    const childTarget = day.includes("طفل — بالحصص");
    console.log("[minor owner] day prompt → adult calorie target:", adultTarget, "| child portions:", childTarget);

    expect(hasChildClause).toBe(false); // KNOWN-BUG: the owner never gets the child-portions clause
    expect(adultTarget).toBe(true); // KNOWN-BUG: a minor owner is given an adult calorie target
  });

  it("an under-18 FAMILY MEMBER is handled correctly (the asymmetry)", async () => {
    const ctx = await buildPlanContext(
      fakeSupabase({
        email: "x",
        label: "x",
        profile: baseProfile(),
        members: [
          {
            id: "m1",
            user_id: "mom",
            name: "لمى",
            role: "other_adult",
            member_type: "adult", // typed adult…
            birth_year: 2012, // …but 14
            sex: "female",
            height_cm: 158,
            weight_kg: 50,
            activity_level: "light",
            primary_goal: "fat_loss",
            preferred_language: "ar",
            display_order: 0,
            meal_mode: "shared",
            dietary_restrictions: [],
            medical_conditions: [],
            allergies: [],
            dislikes: [],
            trimester: null,
            months_postpartum: null,
            high_risk_pregnancy: false,
            school_meal_handling: null,
            picky_eater: false,
            consulted_doctor: false,
            target_weight_kg: null,
            day_nature: null,
            exercise_days: null,
            exercise_type: null,
            water_cups: null,
            water_liters: null,
            sleep_hours: null,
            medications: [],
            supplements: [],
            nausea_foods: [],
            feeding_mode: null,
            workout_profile: null,
          },
        ],
      }),
      "mom",
    );
    expect(ctx.family_members[0]!.is_child).toBe(true);
    expect(buildSkeletonPrompt(ctx)).toContain("حصص الهرم الغذائي");
  });
});
