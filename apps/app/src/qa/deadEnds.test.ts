/**
 * Regression guard for the three "no way out" states the persona sweep found.
 *
 * Dead ends 1 and 2 are FIXED: every surface that decides whether to ask for
 * the doctor confirmation now calls the same `ownerRequiresDoctorSignOff` the
 * generation gate calls, so a profile the UI accepts is always a profile the
 * engine will plan for. These tests replicate each surface's call and assert
 * the agreement — if a surface ever forks its own rule again, they fail.
 *
 * Dead end 3 (under-18 account owner planned as an adult) is NOT fixed; it is
 * a P1 and its assertions are still marked KNOWN-BUG.
 */
import { describe, it, expect } from "vitest";
import {
  buildPlanContext,
  buildSkeletonPrompt,
  buildDayPrompt,
  ownerRequiresDoctorSignOff,
  MedicalGateError,
} from "@fitlife/plan-engine";
import { fakeSupabase, baseProfile } from "./personaHarness";

/** MomWizard.doctorNeeded — the same call the wizard makes. */
function momWizardDoctorNeeded(o: {
  conditions: string[];
  otherCondition: string;
  isMale: boolean;
  pregStatus: string;
}) {
  return ownerRequiresDoctorSignOff({
    medical_conditions: [
      ...o.conditions,
      ...(o.otherCondition.trim() ? [o.otherCondition.trim()] : []),
    ],
    is_pregnant: !o.isMale && o.pregStatus === "pregnant",
  });
}

/** HealthEditForm.doctorNeeded (/profile/health) — the same call it makes. */
function healthFormDoctorNeeded(o: {
  conditions: string[];
  otherCondition: string;
  pregStatus: string;
}) {
  return ownerRequiresDoctorSignOff({
    medical_conditions: [
      ...o.conditions,
      ...(o.otherCondition.trim() ? [o.otherCondition.trim()] : []),
    ],
    is_pregnant: o.pregStatus === "pregnant",
  });
}

/** saveMomHealthInfo / saveMomProfile save-time gate — the same call they make. */
function saveBlocked(o: {
  conditions: string[];
  isPregnant: boolean;
  consultedDoctor: boolean;
}) {
  return (
    ownerRequiresDoctorSignOff({
      medical_conditions: o.conditions,
      is_pregnant: o.isPregnant,
    }) && !o.consultedDoctor
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

describe("FIXED — pregnant, low-risk account owner", () => {
  const pregnantLowRisk = {
    conditions: [],
    otherCondition: "",
    isMale: false,
    pregStatus: "pregnant",
  };

  it("the wizard now asks for the doctor confirmation", () => {
    expect(momWizardDoctorNeeded(pregnantLowRisk)).toBe(true);
  });

  it("/profile/health asks for it too, so she can always unblock herself", () => {
    expect(healthFormDoctorNeeded(pregnantLowRisk)).toBe(true);
  });

  it("and the save-time gate refuses to store the profile the engine would reject", () => {
    expect(
      saveBlocked({ conditions: [], isPregnant: true, consultedDoctor: false }),
    ).toBe(true);
    expect(
      saveBlocked({ conditions: [], isPregnant: true, consultedDoctor: true }),
    ).toBe(false);
  });

  it("a legacy row saved before the fix is still gated — /plan offers the confirmation", async () => {
    const legacy = baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 5,
      high_risk_pregnancy: false,
      consulted_doctor: false,
    });
    expect(await gateOf(legacy)).toBe("blocked");
    // …and the plan page's `needsDoctorSignOff` lights up for exactly that row.
    expect(
      ownerRequiresDoctorSignOff({
        medical_conditions: legacy.medical_conditions as string[],
        has_medical_conditions: legacy.has_medical_conditions as boolean,
        is_pregnant: legacy.is_pregnant as boolean,
      }),
    ).toBe(true);
    expect(
      await gateOf({ ...legacy, consulted_doctor: true }),
    ).toBe("ok");
  });
});

describe("FIXED — a STABLE condition can no longer be saved unconfirmed", () => {
  const conditions = ["anemia"]; // فقر الدم — a STABLE_CONDITIONS entry

  it("the edit form renders the checkbox", () => {
    expect(
      healthFormDoctorNeeded({ conditions, otherCondition: "", pregStatus: "none" }),
    ).toBe(true);
  });

  it("and the save-time gate now blocks it, matching the engine", () => {
    expect(
      saveBlocked({ conditions, isPregnant: false, consultedDoctor: false }),
    ).toBe(true);
  });

  it("a free-text «حالة أخرى» counts the same as a chip", () => {
    expect(
      healthFormDoctorNeeded({
        conditions: [],
        otherCondition: "ربو",
        pregStatus: "none",
      }),
    ).toBe(true);
  });

  it("no condition and no pregnancy → never asked", () => {
    expect(
      healthFormDoctorNeeded({ conditions: [], otherCondition: "", pregStatus: "none" }),
    ).toBe(false);
    expect(
      saveBlocked({ conditions: [], isPregnant: false, consultedDoctor: false }),
    ).toBe(false);
  });
});

describe("every surface agrees with the engine gate (exhaustive)", () => {
  it("UI-asks ⇔ engine-blocks, across the whole owner input space", async () => {
    const conditionSets = [[], ["anemia"], ["heart_disease"], ["pcos", "ibs"]];
    const others = ["", "ربو"];
    const pregStates = ["none", "pregnant", "lactating"];
    let checked = 0;

    for (const conditions of conditionSets) {
      for (const otherCondition of others) {
        for (const pregStatus of pregStates) {
          const stored = [
            ...conditions,
            ...(otherCondition ? [otherCondition] : []),
          ];
          const isPregnant = pregStatus === "pregnant";
          const asks = momWizardDoctorNeeded({
            conditions,
            otherCondition,
            isMale: false,
            pregStatus,
          });
          expect(
            healthFormDoctorNeeded({ conditions, otherCondition, pregStatus }),
          ).toBe(asks);

          const engineBlocks =
            (await gateOf(
              baseProfile({
                medical_conditions: stored,
                has_medical_conditions: stored.length > 0,
                is_pregnant: isPregnant,
                member_type: isPregnant ? "pregnant" : "adult",
                consulted_doctor: false,
              }),
            )) === "blocked";

          expect(engineBlocks).toBe(asks);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(24);
  });
});

describe("KNOWN-BUG (P1) — under-18 account owner is planned as an adult", () => {
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

    expect(hasChildClause).toBe(false); // KNOWN-BUG: the owner never gets the child-portions clause
    expect(day.includes("الهدف: 1900 سعرة")).toBe(true); // KNOWN-BUG: adult calorie target for a minor
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
