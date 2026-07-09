import { describe, it, expect } from "vitest";
import {
  normalizeWorkoutSkeleton,
  normalizeMemberSessions,
  WorkoutProfileSchema,
  WorkoutPlanSchema,
  WorkoutSkeletonSchema,
  splitForDays,
  workoutPlanHasContent,
  type WorkoutPlan,
  type WorkoutProfile,
} from "./schema";
import {
  buildWorkoutSkeletonPrompt,
  buildWorkoutMemberPrompt,
  workoutTrainees,
} from "./systemPrompt";
import type { PlanPromptContext } from "../buildContext";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PROFILE: WorkoutProfile = {
  location: "both",
  equipment: ["dumbbells", "bands"],
  injuries: [],
  injury_notes: null,
  desired_days: 4,
  focus_areas: ["lower_glutes", "core"],
  experience: "beginner",
  session_minutes: "m30_45",
};

function makeContext(overrides?: {
  momWorkout?: Partial<WorkoutProfile> | null;
  momPregnant?: boolean;
  momConditions?: string[];
}): PlanPromptContext {
  const momWorkout =
    overrides?.momWorkout === null
      ? undefined
      : { ...PROFILE, ...(overrides?.momWorkout ?? {}) };
  return {
    mom: {
      id: "user-1",
      display_name: "أم محمد",
      sex: "female",
      member_type: overrides?.momPregnant ? "pregnant" : "adult",
      age: 35,
      height_cm: 165,
      weight_kg: 70,
      activity_level: "moderate",
      primary_goal: "fat_loss",
      dietary_restrictions: [],
      cuisine_preference: "khaleeji",
      medical_conditions: overrides?.momConditions ?? [],
      allergies: [],
      dislikes: [],
      is_pregnant: !!overrides?.momPregnant,
      pregnancy_trimester: overrides?.momPregnant ? 2 : null,
      months_postpartum: null,
      high_risk_pregnancy: false,
      consulted_doctor: true,
      meal_mode: "shared",
      target_weight_kg: 62,
      day_nature: "desk",
      exercise_days: "d3_5",
      exercise_type: "mixed",
      water_cups: 6,
      water_liters: null,
      sleep_hours: 7,
      medications: [],
      supplements: [],
      nausea_foods: [],
      notes: null,
      workout_profile: momWorkout,
    },
    family_members: [],
    family_wide: {
      dietary_restrictions: [],
      dislikes: [],
      cooking_methods: [],
      meal_out_frequency: null,
    },
    composition_summary: "عائلة",
  };
}

// ─── splitForDays — deterministic table ─────────────────────────────────────

describe("splitForDays", () => {
  it("maps each desired-days option to the evidence-based split", () => {
    expect(splitForDays(3)).toContain("جسم كامل");
    expect(splitForDays(4)).toContain("علوي/سفلي");
    expect(splitForDays(5)).toContain("دفع/سحب/أرجل");
    expect(splitForDays(6)).toContain("دفع/سحب/أرجل ×2");
  });
});

// ─── Profile schema ─────────────────────────────────────────────────────────

describe("WorkoutProfileSchema", () => {
  it("accepts a full valid profile", () => {
    expect(WorkoutProfileSchema.safeParse(PROFILE).success).toBe(true);
  });

  it("rejects out-of-enum values", () => {
    expect(
      WorkoutProfileSchema.safeParse({ ...PROFILE, desired_days: 7 }).success,
    ).toBe(false);
    expect(
      WorkoutProfileSchema.safeParse({ ...PROFILE, location: "park" }).success,
    ).toBe(false);
    expect(
      WorkoutProfileSchema.safeParse({ ...PROFILE, focus_areas: [] }).success,
    ).toBe(false);
  });
});

// ─── Plan schema round-trip + content gate ─────────────────────────────────

const VALID_PLAN: WorkoutPlan = {
  week_start_date: "2026-07-05",
  members: [
    {
      member_id: "mom",
      member_name_ar: "أم محمد",
      split_name_ar: "علوي/سفلي ×2",
      weekly_sessions: [
        {
          day_index: 0,
          session_name_ar: "علوي أ",
          warmup_ar: ["5 دقائق مشي سريع", "دوائر كتف"],
          exercises: [
            {
              name_ar: "ضغط دمبل على مقعد",
              name_en: "Dumbbell Bench Press",
              target_muscles_ar: "الصدر والترايسبس",
              sets: 3,
              reps: "8-12",
              rest_seconds: 120,
              rir: "أبقي 2 في الخزان",
              home_variant_ar: "ضغط أرضي بالدمبل",
            },
          ],
          cooldown_ar: ["إطالة صدر"],
          duration_min: 40,
        },
      ],
      progression_notes_ar: "زيدي التكرارات حتى 12 ثم زيدي الوزن.",
      cardio_notes_ar: "8 آلاف خطوة يومياً.",
    },
  ],
  safety_disclaimer_ar: "البرنامج إرشادي ولا يغني عن مختص.",
};

describe("WorkoutPlanSchema", () => {
  it("round-trips a valid plan", () => {
    const parsed = WorkoutPlanSchema.safeParse(VALID_PLAN);
    expect(parsed.success).toBe(true);
  });

  it("rejects a session with zero exercises", () => {
    const bad = structuredClone(VALID_PLAN);
    bad.members[0]!.weekly_sessions[0]!.exercises = [];
    expect(WorkoutPlanSchema.safeParse(bad).success).toBe(false);
  });

  it("workoutPlanHasContent distinguishes real content from shells", () => {
    expect(workoutPlanHasContent(VALID_PLAN)).toBe(true);
  });
});

describe("WorkoutSkeletonSchema", () => {
  it("accepts split + named sessions without exercises", () => {
    const parsed = WorkoutSkeletonSchema.safeParse({
      members: [
        {
          member_id: "mom",
          member_name_ar: "أم محمد",
          split_name_ar: "علوي/سفلي ×2",
          sessions: [
            { day_index: 0, session_name_ar: "علوي أ", main_patterns_ar: ["دفع أفقي"] },
          ],
        },
      ],
      safety_disclaimer_ar: "تنبيه",
    });
    expect(parsed.success).toBe(true);
  });
});

// ─── Trainee selection + prompt safety contract ─────────────────────────────

describe("workoutTrainees", () => {
  it("includes only opted-in adults", () => {
    expect(workoutTrainees(makeContext()).map((t) => t.member_id)).toEqual(["mom"]);
    expect(workoutTrainees(makeContext({ momWorkout: null }))).toEqual([]);
  });
});

describe("workout prompts", () => {
  it("skeleton prompt carries the recommended split, location, and focus areas", () => {
    const prompt = buildWorkoutSkeletonPrompt(makeContext());
    expect(prompt).toContain('member_id="mom"');
    expect(prompt).toContain("علوي/سفلي ×2");
    expect(prompt).toContain("المنزل والنادي معاً");
    expect(prompt).toContain("الأرجل والمؤخرة");
    expect(prompt).toContain("مبتدئة");
  });

  it("pregnancy renders as a hard safety clause", () => {
    const prompt = buildWorkoutSkeletonPrompt(makeContext({ momPregnant: true }));
    expect(prompt).toContain("حامل (الثلث 2)");
    expect(prompt).toContain("قواعد الحمل الإلزامية");
  });

  it("declared injuries render with mandatory-substitution phrasing", () => {
    const ctx = makeContext({
      momWorkout: { injuries: ["knee", "back"], injury_notes: "ألم عند القرفصاء" },
    });
    const prompt = buildWorkoutSkeletonPrompt(ctx);
    expect(prompt).toContain("الركبة");
    expect(prompt).toContain("الظهر");
    expect(prompt).toContain("استبعاد وبدائل إلزامية");
    expect(prompt).toContain("ألم عند القرفصاء");
  });

  it("medical conditions flow into the trainee description", () => {
    const prompt = buildWorkoutSkeletonPrompt(
      makeContext({ momConditions: ["controlled_hypertension"] }),
    );
    expect(prompt).toContain("controlled_hypertension");
    expect(prompt).toContain("قواعد السلامة");
  });

  it("member prompt pins the member and demands home variants for 'both'", () => {
    const ctx = makeContext();
    const skeleton = {
      members: [
        {
          member_id: "mom",
          member_name_ar: "أم محمد",
          split_name_ar: "علوي/سفلي ×2",
          sessions: [
            { day_index: 0, session_name_ar: "علوي أ", main_patterns_ar: ["دفع"] },
            { day_index: 2, session_name_ar: "سفلي أ", main_patterns_ar: ["قرفصاء"] },
          ],
        },
      ],
      safety_disclaimer_ar: "تنبيه",
    };
    const prompt = buildWorkoutMemberPrompt(ctx, skeleton, "mom");
    expect(prompt).toContain('member_id: "mom"');
    expect(prompt).toContain("علوي أ");
    expect(prompt).toContain("home_variant_ar");
  });
});

// ─── Normalization — shape repairs must never fail a run ───────────────────

function sk(days: number[]): Parameters<typeof normalizeWorkoutSkeleton>[0] {
  return {
    members: [
      {
        member_id: "mom",
        member_name_ar: "أم محمد",
        split_name_ar: "علوي/سفلي ×2",
        sessions: days.map((d) => ({
          day_index: d,
          session_name_ar: `جلسة ${d}`,
          main_patterns_ar: ["دفع"],
        })),
      },
    ],
    safety_disclaimer_ar: "تنبيه",
  };
}

describe("normalizeWorkoutSkeleton", () => {
  it("caps an over-emitted week at the trainee's desired days", () => {
    const out = normalizeWorkoutSkeleton(sk([0, 1, 2, 3, 4, 5, 6]), { mom: 4 });
    expect(out.members[0]!.sessions.map((s) => s.day_index)).toEqual([0, 1, 2, 3]);
  });

  it("dedupes duplicate day_index (keeps the first) and sorts", () => {
    const out = normalizeWorkoutSkeleton(sk([3, 1, 3, 0, 1]), { mom: 6 });
    expect(out.members[0]!.sessions.map((s) => s.day_index)).toEqual([0, 1, 3]);
  });

  it("falls back to a 6-session cap when desired days is unknown", () => {
    const out = normalizeWorkoutSkeleton(sk([0, 1, 2, 3, 4, 5, 6]), {});
    expect(out.members[0]!.sessions).toHaveLength(6);
  });

  it("leaves a correct week untouched", () => {
    const out = normalizeWorkoutSkeleton(sk([0, 2, 4]), { mom: 3 });
    expect(out.members[0]!.sessions.map((s) => s.day_index)).toEqual([0, 2, 4]);
  });
});

describe("normalizeMemberSessions", () => {
  it("caps expanded weekly sessions at desired days", () => {
    const sessions = [0, 1, 2, 3, 4].map((d) => ({ day_index: d }));
    expect(normalizeMemberSessions(sessions, 3).map((s) => s.day_index)).toEqual([
      0, 1, 2,
    ]);
  });
});

describe("skeleton prompt count pinning", () => {
  it("pins the session count and forbids rest-day sessions", () => {
    const prompt = buildWorkoutSkeletonPrompt(makeContext());
    expect(prompt).toContain("بالضبط");
    expect(prompt).toContain("لا تُدرجي أيام الراحة");
  });
});
