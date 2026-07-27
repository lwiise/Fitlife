import { describe, it, expect } from "vitest";
import {
  EXERCISE_BY_ID,
  EXERCISE_CATALOG,
} from "./exerciseCatalog";
import {
  GYM_GEAR_SHARE_FLOOR,
  GYM_UPGRADE,
  HOME_SUBSTITUTE,
  PATTERN_STAPLES,
  allowedExerciseIds,
  enforceWorkoutProfileFit,
  homeAllowedIds,
  isGymGearExercise,
  pickSubstitute,
  isInjuryContraindicated,
} from "./equipment";
import { MemberWorkoutSchema, type MemberWorkout, type WorkoutProfile } from "./schema";

const profile = (over?: Partial<WorkoutProfile>): WorkoutProfile => ({
  location: "home",
  equipment: [],
  injuries: [],
  injury_notes: null,
  desired_days: 3,
  focus_areas: ["full_body"],
  experience: "beginner",
  session_minutes: "m30_45",
  ...over,
});

const NO_FLAGS = { pregnant: false, recentPostpartum: false };

function memberWith(
  exercises: Array<Record<string, unknown>>,
): MemberWorkout {
  return MemberWorkoutSchema.parse({
    member_id: "mom",
    member_name_ar: "أم",
    split_name_ar: "جسم كامل",
    weekly_sessions: [
      {
        day_index: 0,
        session_name_ar: "جلسة",
        warmup_ar: ["إحماء"],
        exercises: exercises.map((e) => ({
          name_ar: "تمرين",
          target_muscles_ar: "عضلات",
          sets: 3,
          reps: "8-12",
          rest_seconds: 90,
          ...e,
        })),
        cooldown_ar: [],
        duration_min: 40,
      },
    ],
    progression_notes_ar: "تدرّج",
  });
}

const exerciseIds = (m: MemberWorkout) =>
  m.weekly_sessions[0]!.exercises.map((e) => e.exercise_id);

// ─── Allowed sets ───────────────────────────────────────────────────────────

describe("homeAllowedIds", () => {
  it("no equipment → bodyweight + household furniture only", () => {
    const ids = homeAllowedIds(profile());
    expect(ids.has("squat")).toBe(true);
    expect(ids.has("towel_row")).toBe(true);
    expect(ids.has("wall_sit")).toBe(true); // wall
    expect(ids.has("hip_thrust")).toBe(true); // bench ≈ sturdy chair
    expect(ids.has("step_up")).toBe(true); // box ≈ step
    expect(ids.has("goblet_squat")).toBe(false); // dumbbell
    expect(ids.has("band_row")).toBe(false); // band
    expect(ids.has("lat_pulldown")).toBe(false); // machine
    expect(ids.has("barbell_back_squat")).toBe(false); // barbell
  });

  it("declared dumbbells/bands unlock exactly that gear", () => {
    const ids = homeAllowedIds(profile({ equipment: ["dumbbells", "bands"] }));
    expect(ids.has("goblet_squat")).toBe(true);
    expect(ids.has("db_bench_press")).toBe(true); // dumbbell + bench(furniture)
    expect(ids.has("band_row")).toBe(true);
    expect(ids.has("lat_pulldown")).toBe(false);
    expect(ids.has("barbell_deadlift")).toBe(false);
  });

  it("home «أجهزة منزلية» unlocks cardio machines only — never resistance machinery", () => {
    const ids = homeAllowedIds(profile({ equipment: ["machines"] }));
    expect(ids.has("incline_walk")).toBe(true);
    expect(ids.has("stationary_bike")).toBe(true);
    expect(ids.has("leg_press")).toBe(false);
    expect(ids.has("lat_pulldown")).toBe(false);
    expect(ids.has("chest_press_machine")).toBe(false);
  });

  it("gym and both get the full catalog as main exercises", () => {
    for (const location of ["gym", "both"] as const) {
      const ids = allowedExerciseIds(profile({ location }));
      expect(ids.size).toBe(EXERCISE_CATALOG.length);
    }
  });
});

// ─── Table integrity ────────────────────────────────────────────────────────

describe("substitution tables", () => {
  it("every substitute / staple / upgrade id exists in the catalog", () => {
    for (const list of Object.values(HOME_SUBSTITUTE)) {
      for (const id of list) expect(EXERCISE_BY_ID.has(id)).toBe(true);
    }
    for (const list of Object.values(PATTERN_STAPLES)) {
      for (const id of list) expect(EXERCISE_BY_ID.has(id)).toBe(true);
    }
    for (const [from, to] of Object.entries(GYM_UPGRADE)) {
      expect(EXERCISE_BY_ID.has(from)).toBe(true);
      expect(isGymGearExercise(EXERCISE_BY_ID.get(to)!)).toBe(true);
    }
  });

  it("every exercise resolves a home substitute for a no-equipment profile — pregnant or not", () => {
    const bare = homeAllowedIds(profile());
    for (const ex of EXERCISE_CATALOG) {
      if (bare.has(ex.id)) continue;
      for (const pregnant of [false, true]) {
        const sub = pickSubstitute(ex.id, bare, pregnant);
        expect(sub, `${ex.id} (pregnant=${pregnant})`).not.toBeNull();
        expect(bare.has(sub!)).toBe(true);
        if (pregnant) expect(EXERCISE_BY_ID.get(sub!)!.pregnancy_safe).toBe(true);
      }
    }
  });

  it("the gym roster is deep enough to build a distinct club program", () => {
    const gymGear = EXERCISE_CATALOG.filter(isGymGearExercise);
    expect(gymGear.length).toBeGreaterThanOrEqual(20);
    // Every strength pattern that matters has a gym-gear option.
    for (const pattern of ["squat", "hinge", "push", "pull", "isolation"] as const) {
      expect(gymGear.some((e) => e.pattern === pattern), pattern).toBe(true);
    }
  });
});

// ─── Enforcement: home ──────────────────────────────────────────────────────

describe("enforceWorkoutProfileFit — home", () => {
  it("flags and substitutes machine work a home trainee cannot do", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([{ exercise_id: "lat_pulldown" }, { exercise_id: "squat" }]),
      profile(),
      NO_FLAGS,
    );
    expect(fit.violations).toContain("disallowed:lat_pulldown");
    const [sub, kept] = exerciseIds(fit.member);
    expect(sub).toBe("towel_row"); // first no-equipment candidate
    expect(kept).toBe("squat");
    // Substitution rewrites identity but keeps the programming.
    const ex = fit.member.weekly_sessions[0]!.exercises[0]!;
    expect(ex.name_ar).toBe(EXERCISE_BY_ID.get("towel_row")!.name_ar);
    expect(ex.sets).toBe(3);
    expect(ex.reps).toBe("8-12");
  });

  it("respects declared home dumbbells when substituting", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([{ exercise_id: "seated_cable_row" }]),
      profile({ equipment: ["dumbbells"] }),
      NO_FLAGS,
    );
    expect(exerciseIds(fit.member)).toEqual(["one_arm_db_row"]);
  });

  it("keeps pregnancy-safe substitutions for pregnant trainees", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([{ exercise_id: "leg_curl" }]),
      profile(),
      { pregnant: true, recentPostpartum: false },
    );
    // leg_curl candidates: romanian_deadlift (needs dumbbell), glute_bridge
    // (supine — not pregnancy-safe) → isolation staple calf_raise (safe).
    expect(exerciseIds(fit.member)).toEqual(["calf_raise"]);
  });

  it("strips stray home variants — the toggle must not appear outside «كلاهما»", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "squat", home_variant_ar: "سكوات منزلي", home_variant_id: "squat" },
      ]),
      profile(),
      NO_FLAGS,
    );
    const ex = fit.member.weekly_sessions[0]!.exercises[0]!;
    expect(ex.home_variant_ar).toBeNull();
    expect(ex.home_variant_id).toBeNull();
  });

  it("leaves null-id exercises untouched and reports no violation", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([{ exercise_id: null, name_ar: "حركة حرة" }]),
      profile(),
      NO_FLAGS,
    );
    expect(fit.violations).toEqual([]);
    expect(fit.member.weekly_sessions[0]!.exercises[0]!.name_ar).toBe("حركة حرة");
  });
});

// ─── Enforcement: gym ───────────────────────────────────────────────────────

describe("enforceWorkoutProfileFit — gym", () => {
  it("flags an all-bodyweight club program and upgrades it onto gym gear", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "squat" },
        { exercise_id: "pushup" },
        { exercise_id: "band_row" },
        { exercise_id: "glute_bridge" },
      ]),
      profile({ location: "gym" }),
      NO_FLAGS,
    );
    expect(fit.violations.some((v) => v.startsWith("gym_share_low"))).toBe(true);
    expect(fit.gymShareOk).toBe(true);
    const ids = exerciseIds(fit.member);
    const gymGear = ids.filter((id) => isGymGearExercise(EXERCISE_BY_ID.get(id!)!));
    expect(gymGear.length / ids.length).toBeGreaterThanOrEqual(GYM_GEAR_SHARE_FLOOR);
  });

  it("accepts a genuine club program (machines/barbell/dumbbell mix) unchanged", () => {
    const original = memberWith([
      { exercise_id: "barbell_back_squat" },
      { exercise_id: "leg_press" },
      { exercise_id: "goblet_squat" },
      { exercise_id: "lat_pulldown" },
    ]);
    const fit = enforceWorkoutProfileFit(original, profile({ location: "gym" }), NO_FLAGS);
    expect(fit.violations).toEqual([]);
    expect(fit.gymShareOk).toBe(true);
    expect(exerciseIds(fit.member)).toEqual([
      "barbell_back_squat",
      "leg_press",
      "goblet_squat",
      "lat_pulldown",
    ]);
  });

  it("waives the gym-gear floor for pregnant trainees — safety governs their programming", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([{ exercise_id: "wall_pushup" }, { exercise_id: "squat" }]),
      profile({ location: "gym" }),
      { pregnant: true, recentPostpartum: false },
    );
    expect(fit.violations).toEqual([]);
    expect(exerciseIds(fit.member)).toEqual(["wall_pushup", "squat"]);
  });

  it("does not count warm-up/core/stretch patterns against the floor", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "leg_press" },
        { exercise_id: "lat_pulldown" },
        { exercise_id: "plank" },
        { exercise_id: "bird_dog" },
        { exercise_id: "hamstring_stretch" },
        { exercise_id: "march_in_place" },
      ]),
      profile({ location: "gym" }),
      NO_FLAGS,
    );
    expect(fit.violations).toEqual([]);
  });
});

// ─── Enforcement: both ──────────────────────────────────────────────────────

describe("enforceWorkoutProfileFit — both", () => {
  it("fills a missing home variant for a gym-gear exercise, legal for the declared tools", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "chest_press_machine" },
        { exercise_id: "leg_press" },
      ]),
      profile({ location: "both", equipment: ["dumbbells"] }),
      NO_FLAGS,
    );
    expect(fit.violations).toContain("variant_missing:chest_press_machine");
    const [chest, legs] = fit.member.weekly_sessions[0]!.exercises;
    expect(chest!.home_variant_id).toBe("db_bench_press");
    expect(chest!.home_variant_ar).toBe(EXERCISE_BY_ID.get("db_bench_press")!.name_ar);
    expect(legs!.home_variant_id).toBe("goblet_squat");
  });

  it("replaces an illegal home variant (machine at home) with a legal one", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "lat_pulldown", home_variant_ar: "سحب", home_variant_id: "seated_cable_row" },
      ]),
      profile({ location: "both", equipment: [] }),
      NO_FLAGS,
    );
    expect(fit.violations).toContain("variant_disallowed:seated_cable_row");
    const ex = fit.member.weekly_sessions[0]!.exercises[0]!;
    expect(ex.home_variant_id).toBe("towel_row");
  });

  it("accepts a compliant both-program unchanged", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "lat_pulldown", home_variant_ar: "تجديف بالحبل", home_variant_id: "band_row" },
        { exercise_id: "leg_press", home_variant_ar: "سكوات جوبلت", home_variant_id: "goblet_squat" },
      ]),
      profile({ location: "both", equipment: ["dumbbells", "bands"] }),
      NO_FLAGS,
    );
    expect(fit.violations).toEqual([]);
    expect(fit.member.weekly_sessions[0]!.exercises[0]!.home_variant_id).toBe("band_row");
  });

  it("gym upgrades in a both-program carry home variants with them", () => {
    const fit = enforceWorkoutProfileFit(
      memberWith([
        { exercise_id: "squat", home_variant_ar: "سكوات", home_variant_id: "squat" },
        { exercise_id: "pushup", home_variant_ar: "ضغط", home_variant_id: "pushup" },
      ]),
      profile({ location: "both", equipment: [] }),
      NO_FLAGS,
    );
    expect(fit.violations.some((v) => v.startsWith("gym_share_low"))).toBe(true);
    for (const ex of fit.member.weekly_sessions[0]!.exercises) {
      if (!isGymGearExercise(EXERCISE_BY_ID.get(ex.exercise_id!)!)) continue;
      expect(ex.home_variant_id).not.toBeNull();
      expect(homeAllowedIds(profile()).has(ex.home_variant_id!)).toBe(true);
    }
  });
});

/**
 * Declared injuries reach the MODEL as a mandatory exclusion clause
 * («إصابات معلنة (استبعاد وبدائل إلزامية)»). They must also bind the
 * DETERMINISTIC repair, which ships on the final attempt instead of a re-roll —
 * otherwise code installs the exact movement the questionnaire was asked in
 * order to avoid.
 */
describe("injuries bind the deterministic repair, not just the prompt", () => {
  const HOME_BODYWEIGHT = homeAllowedIds({ equipment: [] });

  it("never substitutes a knee-injured trainee INTO a squat or lunge", () => {
    // leg_press is illegal at home; its substitutes are goblet_squat/squat —
    // both squat-pattern, both ruled out by a knee injury.
    const sub = pickSubstitute("leg_press", HOME_BODYWEIGHT, false, ["knee"]);
    expect(sub).toBeNull();
    // Without the injury the same call still resolves, so this is the injury
    // doing the work rather than the table being empty.
    expect(pickSubstitute("leg_press", HOME_BODYWEIGHT, false, [])).not.toBeNull();
  });

  it("never substitutes a back-injured trainee INTO a hinge", () => {
    for (const id of ["barbell_deadlift", "leg_curl"]) {
      const sub = pickSubstitute(id, HOME_BODYWEIGHT, false, ["back"]);
      if (sub) {
        expect(isInjuryContraindicated(sub, ["back"])).toBe(false);
      }
    }
  });

  it("never substitutes a shoulder-injured trainee INTO a push or pull", () => {
    for (const id of ["chest_press_machine", "lat_pulldown", "seated_cable_row"]) {
      const sub = pickSubstitute(id, HOME_BODYWEIGHT, false, ["shoulder"]);
      if (sub) expect(isInjuryContraindicated(sub, ["shoulder"])).toBe(false);
    }
  });

  it("holds for EVERY catalog id and every single injury", () => {
    for (const inj of ["knee", "back", "shoulder"]) {
      for (const ex of EXERCISE_CATALOG) {
        const sub = pickSubstitute(ex.id, HOME_BODYWEIGHT, false, [inj]);
        if (sub === null) continue; // dropping the id is the safe outcome
        expect(
          isInjuryContraindicated(sub, [inj]),
          `${ex.id} -> ${sub} is contraindicated for ${inj}`,
        ).toBe(false);
      }
    }
  });

  it("leaves an uninjured trainee's substitutions exactly as they were", () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(pickSubstitute(ex.id, HOME_BODYWEIGHT, false, [])).toBe(
        pickSubstitute(ex.id, HOME_BODYWEIGHT, false, undefined),
      );
    }
  });

  it("treats 'other' as unknown rather than guessing an exclusion", () => {
    // We do not know what «أخرى» means; the model handles it via injury_notes.
    for (const ex of EXERCISE_CATALOG) {
      expect(isInjuryContraindicated(ex.id, ["other"])).toBe(false);
    }
  });

  it("maps each injury to the patterns it rules out", () => {
    expect(isInjuryContraindicated("squat", ["knee"])).toBe(true);
    expect(isInjuryContraindicated("lunge", ["knee"])).toBe(true);
    expect(isInjuryContraindicated("romanian_deadlift", ["back"])).toBe(true);
    expect(isInjuryContraindicated("pushup", ["shoulder"])).toBe(true);
    // and does not over-reach
    expect(isInjuryContraindicated("pushup", ["knee"])).toBe(false);
    expect(isInjuryContraindicated("plank", ["knee", "back", "shoulder"])).toBe(false);
  });
});
