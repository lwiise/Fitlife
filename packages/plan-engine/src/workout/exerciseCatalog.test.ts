import { describe, it, expect } from "vitest";
import {
  EXERCISE_CATALOG,
  EXERCISE_BY_ID,
  FALLBACK_BY_PATTERN,
  exerciseCatalogPromptBlock,
} from "./exerciseCatalog";
import { normalizeExerciseIds, MemberWorkoutSchema, type MemberWorkout } from "./schema";
import { mealGenBlocksWorkout } from "./generate";
import { WORKOUT_STATIC } from "./systemPrompt";

describe("EXERCISE_CATALOG", () => {
  it("has unique, url-safe ids", () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it("every pattern fallback points at a real catalog entry", () => {
    for (const id of Object.values(FALLBACK_BY_PATTERN)) {
      expect(EXERCISE_BY_ID.has(id)).toBe(true);
    }
  });

  it("machine-only exercises are never marked home_ok", () => {
    for (const e of EXERCISE_CATALOG) {
      if (e.equipment.includes("machine") || e.equipment.includes("barbell")) {
        expect(e.home_ok).toBe(false);
      }
    }
  });

  it("pregnancy-safe entries never include jumping or supine core staples", () => {
    for (const id of ["jumping_jacks", "crunch", "leg_raises", "glute_bridge", "pushup"]) {
      expect(EXERCISE_BY_ID.get(id)?.pregnancy_safe).toBe(false);
    }
    for (const id of ["kegel", "pelvic_tilt", "wall_pushup", "bird_dog", "brisk_walk"]) {
      expect(EXERCISE_BY_ID.get(id)?.pregnancy_safe).toBe(true);
    }
  });

  it("is embedded in the cached workout static prompt", () => {
    expect(WORKOUT_STATIC).toContain("كتالوج التمارين المعتمد");
    expect(exerciseCatalogPromptBlock()).toContain("- squat —");
    // Every id appears in the prompt roster.
    for (const e of EXERCISE_CATALOG) {
      expect(WORKOUT_STATIC).toContain(`- ${e.id} —`);
    }
  });
});

const memberWith = (exercise: Record<string, unknown>): MemberWorkout =>
  MemberWorkoutSchema.parse({
    member_id: "mom",
    member_name_ar: "أم",
    split_name_ar: "جسم كامل",
    weekly_sessions: [
      {
        day_index: 0,
        session_name_ar: "جلسة",
        warmup_ar: ["إحماء"],
        exercises: [
          {
            name_ar: "تمرين",
            target_muscles_ar: "عضلات",
            sets: 3,
            reps: "8-12",
            rest_seconds: 90,
            ...exercise,
          },
        ],
        cooldown_ar: [],
        duration_min: 40,
      },
    ],
    progression_notes_ar: "تدرّج",
  });

describe("normalizeExerciseIds", () => {
  it("keeps known catalog ids", () => {
    const { member, unknownIds } = normalizeExerciseIds(
      memberWith({ exercise_id: "squat", home_variant_id: "wall_pushup" }),
    );
    expect(unknownIds).toEqual([]);
    expect(member.weekly_sessions[0]!.exercises[0]!.exercise_id).toBe("squat");
    expect(member.weekly_sessions[0]!.exercises[0]!.home_variant_id).toBe("wall_pushup");
  });

  it("nulls unknown ids and reports them", () => {
    const { member, unknownIds } = normalizeExerciseIds(
      memberWith({ exercise_id: "invented_move", home_variant_id: "another_fake" }),
    );
    expect(unknownIds).toEqual(["invented_move", "another_fake"]);
    expect(member.weekly_sessions[0]!.exercises[0]!.exercise_id).toBeNull();
    expect(member.weekly_sessions[0]!.exercises[0]!.home_variant_id).toBeNull();
  });

  it("parses pre-catalog plans (no exercise_id at all) unchanged", () => {
    const { member, unknownIds } = normalizeExerciseIds(memberWith({}));
    expect(unknownIds).toEqual([]);
    expect(member.weekly_sessions[0]!.exercises[0]!.exercise_id ?? null).toBeNull();
  });
});

describe("mealGenBlocksWorkout (meals-first sequencing)", () => {
  const now = Date.parse("2026-07-09T12:00:00Z");
  const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();

  it("blocks while a fresh meal generation is started", () => {
    expect(mealGenBlocksWorkout([{ status: "started", started_at: iso(2) }], now)).toBe(true);
    expect(mealGenBlocksWorkout([{ status: "started", started_at: iso(14) }], now)).toBe(true);
  });

  it("ignores stale started rows (hard-killed worker) and settled rows", () => {
    expect(mealGenBlocksWorkout([{ status: "started", started_at: iso(16) }], now)).toBe(false);
    expect(mealGenBlocksWorkout([{ status: "completed", started_at: iso(1) }], now)).toBe(false);
    expect(mealGenBlocksWorkout([{ status: "failed", started_at: iso(1) }], now)).toBe(false);
  });

  it("does not block on empty results or unparseable timestamps", () => {
    expect(mealGenBlocksWorkout([], now)).toBe(false);
    expect(mealGenBlocksWorkout([{ status: "started", started_at: "not-a-date" }], now)).toBe(false);
    expect(mealGenBlocksWorkout([{ status: "started", started_at: null }], now)).toBe(false);
  });
});
