/**
 * QA persona matrix (temporary, exploratory): drives the REAL onboarding →
 * context → prompt path for every signup variation, one simulated account per
 * test email (claude2@gmail.com … claudeN@gmail.com). Findings are printed, not
 * asserted, so one broken persona doesn't hide the rest.
 */
import { describe, it, expect } from "vitest";
import {
  buildPlanContext,
  buildSkeletonPrompt,
  buildDayPrompt,
  getBeneficiaries,
  workoutTrainees,
  MedicalGateError,
  OnboardingIncompleteError,
  type PlanPromptContext,
} from "@fitlife/plan-engine";
import { fakeSupabase, baseProfile, baseMember, type FakeAccount } from "./personaHarness";
import {
  familyMemberInputSchema,
  momProfileInputSchema,
  firstFieldErrorAr,
} from "@/app/onboarding/serverSchemas";
import { mapUserGoalToSara } from "@/lib/plans/goalMapping";
import { activityLevelFrom } from "@/lib/plans/activityLevel";
import { isWorkoutEligibleMom } from "@/lib/plans/workoutEligibility";

const WORKOUT_HOME = {
  location: "home" as const,
  equipment: ["none" as const],
  injuries: [],
  desired_days: 4 as const,
  preferred_days: [0, 2, 4, 6],
  focus_areas: ["full_body" as const],
  experience: "beginner" as const,
  session_minutes: "m30_45" as const,
};

const WORKOUT_GYM = {
  location: "gym" as const,
  equipment: ["machines" as const, "dumbbells" as const],
  injuries: ["knee" as const],
  injury_notes: "ألم في الركبة اليمنى",
  desired_days: 6 as const,
  preferred_days: null,
  focus_areas: ["strength" as const, "lower_glutes" as const],
  experience: "intermediate" as const,
  session_minutes: "m45_60" as const,
};

const ACCOUNTS: FakeAccount[] = [
  {
    email: "claude2@gmail.com",
    label: "Solo female, fat loss, no conditions (baseline happy path)",
    profile: baseProfile(),
    members: [],
  },
  {
    email: "claude3@gmail.com",
    label:
      "Solo female, PREGNANT month 5, NOT high-risk — LEGACY row saved before the doctor-gate fix (still gated; /plan now offers the confirmation)",
    profile: baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 5,
      pregnancy_trimester: 2,
      high_risk_pregnancy: false,
      consulted_doctor: false, // the wizard now requires this before saving
      primary_goal: "pregnancy_lactation",
      nausea_foods: ["بيض"],
    }),
    members: [],
  },
  {
    email: "claude3b@gmail.com",
    label: "Solo female, PREGNANT month 5, NOT high-risk — post-fix (doctor step confirmed)",
    profile: baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 5,
      pregnancy_trimester: 2,
      high_risk_pregnancy: false,
      consulted_doctor: true,
      primary_goal: "pregnancy_lactation",
      nausea_foods: ["بيض"],
    }),
    members: [],
  },
  {
    email: "claude4@gmail.com",
    label: "Solo female, pregnant HIGH-RISK (doctor step shown, confirmed)",
    profile: baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 8,
      pregnancy_trimester: 3,
      high_risk_pregnancy: true,
      consulted_doctor: true,
      primary_goal: "pregnancy_lactation",
    }),
    members: [],
  },
  {
    email: "claude5@gmail.com",
    label: "Solo female, LACTATING exclusive, 3 months postpartum",
    profile: baseProfile({
      member_type: "lactating",
      months_postpartum: 3,
      feeding_mode: "exclusive",
      primary_goal: "pregnancy_lactation",
      consulted_doctor: false,
    }),
    members: [],
  },
  {
    email: "claude6@gmail.com",
    label: "Female with PCOS (STABLE condition) who chose «خسارة الدهون»",
    profile: baseProfile({
      medical_conditions: ["pcos"],
      has_medical_conditions: true,
      consulted_doctor: true,
      primary_goal: mapUserGoalToSara("lose_weight", {
        hasMedical: true,
        isPregnantOrLactating: false,
        conditions: ["pcos"],
      }),
    }),
    members: [],
  },
  {
    email: "claude7@gmail.com",
    label: "MALE account owner, muscle gain, solo",
    profile: baseProfile({
      sex: "male",
      display_name: "خالد",
      height_cm: 180,
      weight_kg: 88,
      primary_goal: "muscle_gain",
      activity_level: "moderate",
    }),
    members: [],
  },
  {
    email: "claude8@gmail.com",
    label: "Family: mom + husband + 2 children (7, 12) + housekeeper (Tagalog)",
    profile: baseProfile({ family_dislikes: ["كبدة"], meal_out_frequency: "rarely" }),
    members: [
      baseMember({ name: "أبو محمد", role: "dad", sex: "male", birth_year: 1985 }),
      baseMember({
        name: "محمد",
        role: "son",
        member_type: "child",
        sex: "male",
        birth_year: 2014,
        height_cm: 148,
        weight_kg: 40,
        activity_level: "moderate",
        primary_goal: null,
        school_meal_handling: "home_packed",
      }),
      baseMember({
        name: "نورة",
        role: "daughter",
        member_type: "child",
        sex: "female",
        birth_year: 2019,
        height_cm: 122,
        weight_kg: 24,
        activity_level: "active",
        primary_goal: null,
        picky_eater: true,
        school_meal_handling: "mixed",
      }),
      baseMember({
        name: "ماريا",
        role: "housekeeper",
        member_type: "housekeeper",
        preferred_language: "tl",
        birth_year: null,
        height_cm: null,
        weight_kg: null,
        activity_level: null,
        primary_goal: null,
      }),
    ],
  },
  {
    email: "claude9@gmail.com",
    label: "Family with a 4-year-old (102 cm / 16 kg) — the small-child case",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "ريان",
        role: "son",
        member_type: "child",
        sex: "male",
        birth_year: 2022,
        height_cm: 102,
        weight_kg: 16,
        activity_level: "active",
        primary_goal: null,
      }),
    ],
  },
  {
    email: "claude10@gmail.com",
    label:
      "Family with a PREGNANT member — LEGACY row from before the wizard asked about activity (activity_level null)",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "هند",
        role: "other_adult",
        member_type: "pregnant",
        sex: "female",
        birth_year: 1996,
        height_cm: 165,
        weight_kg: 68,
        activity_level: null, // the wizard now asks; see claude10b
        primary_goal: "pregnancy_lactation",
        trimester: 2,
        high_risk_pregnancy: false,
        consulted_doctor: true,
        water_liters: "l1_2",
      }),
    ],
  },
  {
    email: "claude10b@gmail.com",
    label:
      "Pregnant member added AFTER the fix — the wizard's exercise step now stores an activity level",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "هند",
        role: "other_adult",
        member_type: "pregnant",
        sex: "female",
        birth_year: 1996,
        height_cm: 165,
        weight_kg: 68,
        day_nature: "moderate_movement",
        exercise_days: "d1_2",
        exercise_type: "cardio",
        activity_level: activityLevelFrom("moderate_movement", "d1_2"),
        primary_goal: "pregnancy_lactation",
        trimester: 2,
        high_risk_pregnancy: false,
        consulted_doctor: true,
        water_liters: "l1_2",
      }),
    ],
  },
  {
    email: "claude11@gmail.com",
    label: "Mom + 17-year-old typed as ADULT with independent meals",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "لمى",
        role: "other_adult",
        member_type: "adult",
        sex: "female",
        birth_year: 2009,
        height_cm: 163,
        weight_kg: 55,
        meal_mode: "independent",
        primary_goal: "muscle_gain",
        day_nature: "desk",
        exercise_days: "d3_5",
        exercise_type: "resistance",
        activity_level: activityLevelFrom("desk", "d3_5"),
      }),
    ],
  },
  {
    email: "claude12@gmail.com",
    label: "Solo female + workout opt-in (home, no equipment, 4 chosen weekdays)",
    profile: baseProfile({ workout_profile: WORKOUT_HOME }),
    members: [],
  },
  {
    email: "claude13@gmail.com",
    label: "Mom (meals only) + husband opted into a GYM workout, knee injury",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "فهد",
        role: "dad",
        sex: "male",
        birth_year: 1990,
        workout_profile: WORKOUT_GYM,
      }),
    ],
  },
  {
    email: "claude14@gmail.com",
    label: "PREGNANT mom who also opted into workouts",
    profile: baseProfile({
      member_type: "pregnant",
      is_pregnant: true,
      pregnancy_month: 6,
      pregnancy_trimester: 2,
      high_risk_pregnancy: false,
      consulted_doctor: true,
      primary_goal: "pregnancy_lactation",
      workout_profile: WORKOUT_HOME,
    }),
    members: [],
  },
  {
    email: "claude15@gmail.com",
    label: "UNDER-18 account owner (birth_year 2012) — signup accepts it",
    profile: baseProfile({ birth_year: 2012, height_cm: 158, weight_kg: 50, workout_profile: WORKOUT_HOME }),
    members: [],
  },
  {
    email: "claude16@gmail.com",
    label: "Mom with a GATE condition (heart disease) + doctor confirmed",
    profile: baseProfile({
      medical_conditions: ["heart_disease"],
      has_medical_conditions: true,
      consulted_doctor: true,
      primary_goal: "metabolic_health",
      medications: ["أسبرين"],
    }),
    members: [],
  },
  {
    email: "claude17@gmail.com",
    label: "Family member with a GATE condition but consulted_doctor=false",
    profile: baseProfile(),
    members: [
      baseMember({
        name: "سلمان",
        role: "dad",
        medical_conditions: ["kidney_disease"],
        consulted_doctor: false,
      }),
    ],
  },
  {
    email: "claude18@gmail.com",
    label: "Solo female who never finished onboarding (onboarding_completed_at null)",
    profile: baseProfile({ onboarding_completed_at: null }),
    members: [],
  },
];

interface Outcome {
  email: string;
  label: string;
  gate: "ok" | "MedicalGateError" | "OnboardingIncompleteError" | string;
  beneficiaries?: number;
  trainees?: string[];
  skeletonChars?: number;
  notes: string[];
}

const outcomes: Outcome[] = [];

describe("persona matrix — signup variations through the real engine", () => {
  for (const account of ACCOUNTS) {
    it(`${account.email} — ${account.label}`, async () => {
      const notes: string[] = [];
      let context: PlanPromptContext | null = null;
      let gate: Outcome["gate"] = "ok";
      try {
        context = await buildPlanContext(fakeSupabase(account), "mom");
      } catch (err) {
        gate =
          err instanceof MedicalGateError
            ? "MedicalGateError"
            : err instanceof OnboardingIncompleteError
              ? "OnboardingIncompleteError"
              : `${(err as Error).name}: ${(err as Error).message}`;
      }

      if (!context) {
        outcomes.push({ email: account.email, label: account.label, gate, notes });
        expect(gate).toBeTruthy();
        return;
      }

      const beneficiaries = getBeneficiaries(context);
      const trainees = workoutTrainees(context).map((t) => t.name);
      const skeleton = buildSkeletonPrompt(context);

      // ── Signal checks on the rendered prompt ────────────────────────────
      if (skeleton.includes("نشاطها غير محدد") || skeleton.includes("نشاطه غير محدد"))
        notes.push("PROMPT: an eater has NO activity level → TDEE multiplier is guessed");
      if (skeleton.includes("هدفها غير محدد") || skeleton.includes("هدفه غير محدد"))
        notes.push("PROMPT: an eater has NO primary goal");
      if (/الثلث غير محدد/.test(skeleton))
        notes.push("PROMPT: pregnancy stage rendered as «غير محدد»");
      if (/مرّ غير محدد شهر/.test(skeleton))
        notes.push("PROMPT: lactation stage rendered as «غير محدد»");

      for (const b of beneficiaries) {
        const m = context.family_members.find((x) => x.id === b.member_id);
        if (!m) continue;
        if (m.member_type !== "child" && !m.is_child && m.activity_level == null)
          notes.push(`DATA: adult member «${m.name}» has activity_level = null`);
        if (m.height_cm == null || m.weight_kg == null)
          notes.push(`DATA: «${m.name}» missing height/weight`);
      }

      // Day-1 prompt must never render an empty meal line for anyone.
      const fakeSkeleton = {
        safety_disclaimer_ar: "x",
        members: beneficiaries.map((b) => ({
          member_id: b.member_id,
          daily_calories_target: 1800,
          macros_target: { protein_g: 120, carbs_g: 180, fat_g: 60 },
          days: [
            {
              day_index: 0,
              day_name_ar: "الأحد",
              meals: [
                { slot: "breakfast" as const, slot_name_ar: "فطور", recipe_name_ar: "شوفان" },
              ],
            },
          ],
        })),
      };
      const day = buildDayPrompt(context, fakeSkeleton as never, 0);

      outcomes.push({
        email: account.email,
        label: account.label,
        gate,
        beneficiaries: beneficiaries.length,
        trainees,
        skeletonChars: skeleton.length,
        notes,
      });

      expect(skeleton.length).toBeGreaterThan(200);
      expect(day.length).toBeGreaterThan(200);
    });
  }

  it("ZZ — prints the persona report", () => {
    const lines: string[] = ["", "════ PERSONA MATRIX REPORT ════"];
    for (const o of outcomes) {
      lines.push(`\n${o.email} — ${o.label}`);
      lines.push(`   gate=${o.gate} beneficiaries=${o.beneficiaries ?? "-"} trainees=[${(o.trainees ?? []).join(", ")}]`);
      for (const n of o.notes) lines.push(`   ⚠ ${n}`);
    }
    console.log(lines.join("\n"));
    expect(outcomes.length).toBe(ACCOUNTS.length);
  });
});

describe("wizard → server-schema contract", () => {
  // Exactly what MemberWizard.assemble() produces for a small child that
  // passes its own client-side physicalRangeError() check (40-250 cm, 5-300 kg).
  const smallChild = {
    member_type: "child" as const,
    role: "son",
    name: "ريان",
    birth_year: 2022,
    sex: "male",
    height_cm: 102,
    weight_kg: 16,
    activity_level: "active",
    day_nature: undefined,
    exercise_days: undefined,
    exercise_type: null,
    target_weight_kg: null,
    water_liters: null,
    sleep_hours: null,
    medications: [],
    supplements: [],
    nausea_foods: [],
    feeding_mode: null,
    user_goal: undefined,
    allergies: [],
    dislikes: [],
    conditions: [],
    other_condition: undefined,
    consulted_doctor: false,
    meal_mode: "shared" as const,
    school_meal_handling: "home_packed",
    picky_eater: false,
    trimester: null,
    high_risk_pregnancy: false,
    months_postpartum: null,
  };

  it("a 4-year-old the CLIENT accepts is now accepted by the SERVER schema too", () => {
    const parsed = familyMemberInputSchema.safeParse(smallChild);
    if (!parsed.success) {
      console.log(
        "[small child] REJECTED →",
        JSON.stringify(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)),
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("accepts every realistic child size, down to a toddler", () => {
    const rejected: string[] = [];
    for (const [age, h, w] of [
      [1, 76, 10],
      [3, 96, 14],
      [5, 110, 18],
      [6, 116, 21],
      [7, 122, 23],
      [10, 138, 32],
    ] as [number, number, number][]) {
      const ok = familyMemberInputSchema.safeParse({
        ...smallChild,
        birth_year: new Date().getFullYear() - age,
        height_cm: h,
        weight_kg: w,
      }).success;
      if (!ok) rejected.push(`age ${age} (${h}cm/${w}kg)`);
    }
    expect(rejected).toEqual([]);
  });

  it("still rejects impossible sizes, with a field-level Arabic message", () => {
    const parsed = familyMemberInputSchema.safeParse({
      ...smallChild,
      weight_kg: 2,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstFieldErrorAr(parsed.error)).toBe("يجب أن يكون الوزن بين 5 و300 كجم");
    }
  });

  it("mom schema now enforces the same 13+ floor the client does", () => {
    const base = {
      display_name: "لينا",
      height_cm: 120,
      weight_kg: 30,
      activity_level: "light" as const,
      user_goal: "lose_weight" as const,
      pregnancy_status: "none" as const,
      high_risk_pregnancy: false,
      allergies: [],
      dislikes: [],
      conditions: [],
      consulted_doctor: false,
    };
    const year = new Date().getFullYear();
    // A toddler owner is impossible now.
    expect(momProfileInputSchema.safeParse({ ...base, birth_year: year - 4 }).success).toBe(
      false,
    );
    // 13 is the floor both sides agree on, and she stays workout-ineligible.
    expect(momProfileInputSchema.safeParse({ ...base, birth_year: year - 13 }).success).toBe(
      true,
    );
    expect(isWorkoutEligibleMom({ birth_year: year - 13 })).toBe(false);
  });
});

describe("goal mapping — what a stated goal turns into", () => {
  it("prints the full goal × condition matrix", () => {
    const goals = [
      "lose_weight",
      "build_muscle",
      "recomposition",
      "maintain_weight",
      "athletic",
      "improve_health",
    ] as const;
    const conditionSets: [string, string[]][] = [
      ["none", []],
      ["pcos (stable)", ["pcos"]],
      ["anemia (stable)", ["anemia"]],
      ["ibs (stable)", ["ibs"]],
      ["heart_disease (gate)", ["heart_disease"]],
    ];
    const lines = ["", "════ GOAL MAPPING MATRIX ════"];
    for (const [name, conds] of conditionSets) {
      const row = goals.map(
        (g) =>
          `${g}→${mapUserGoalToSara(g, {
            hasMedical: conds.length > 0,
            isPregnantOrLactating: false,
            conditions: conds,
          })}`,
      );
      lines.push(`${name}:\n   ${row.join("\n   ")}`);
    }
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(3);
  });
});
