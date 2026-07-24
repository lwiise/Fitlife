/**
 * Location/equipment fit rules — the deterministic layer that guarantees a
 * generated program matches what the trainee actually declared in onboarding:
 *
 * - home: only exercises doable with the DECLARED home tools (+ bodyweight and
 *   household furniture). «أجهزة منزلية» unlocks cardio machines only
 *   (treadmill/bike) — resistance machinery is never assumed at home.
 * - gym: the full catalog is available, but a gym program must actually USE
 *   the gym — at least half of the main strength work on gym gear
 *   (machine/barbell), enforced via `gymGearShare` + `GYM_UPGRADE`.
 * - both: a full gym program whose every gym-gear exercise carries a home
 *   variant legal for the declared home tools.
 *
 * The model is prompted with these rules AND they are enforced post-parse in
 * generate.ts: violations re-roll the call; the final attempt is repaired
 * deterministically from the substitution tables below (log-only, a member is
 * never dropped over equipment fit).
 */

import {
  EXERCISE_BY_ID,
  EXERCISE_CATALOG,
  type CatalogExercise,
  type ExercisePattern,
} from "./exerciseCatalog";
import type { MemberWorkout, WorkoutExercise, WorkoutProfile } from "./schema";

/** Household stand-ins assumed in every home: a wall, a step (درجة), and a
 * sturdy chair/sofa edge in place of a bench. */
const HOME_FURNITURE: ReadonlySet<string> = new Set(["wall", "box", "bench"]);

/** What the declared home-equipment answers actually unlock. */
const DECLARED_GEAR: Partial<Record<WorkoutProfile["equipment"][number], CatalogExercise["equipment"][number]>> = {
  dumbbells: "dumbbell",
  bands: "band",
};

/** Home «أجهزة منزلية» = treadmill or stationary bike — cardio only. */
const HOME_CARDIO_MACHINE_IDS: ReadonlySet<string> = new Set([
  "incline_walk",
  "stationary_bike",
]);

/** Exercise ids legal for this trainee's HOME (their declared tools). */
export function homeAllowedIds(profile: Pick<WorkoutProfile, "equipment">): Set<string> {
  const gear = new Set<string>(HOME_FURNITURE);
  for (const declared of profile.equipment) {
    const g = DECLARED_GEAR[declared];
    if (g) gear.add(g);
  }
  const hasHomeMachines = profile.equipment.includes("machines");
  const out = new Set<string>();
  for (const ex of EXERCISE_CATALOG) {
    if (ex.home_ok && ex.equipment.every((g) => gear.has(g))) out.add(ex.id);
    else if (hasHomeMachines && HOME_CARDIO_MACHINE_IDS.has(ex.id)) out.add(ex.id);
  }
  return out;
}

/** Exercise ids legal as this trainee's MAIN program exercises. */
export function allowedExerciseIds(profile: WorkoutProfile): Set<string> {
  if (profile.location === "home") return homeAllowedIds(profile);
  // gym / both: everything — home-friendly moves also exist in a club.
  return new Set(EXERCISE_CATALOG.map((e) => e.id));
}

/** Gym-defining gear — what makes a session unmistakably a club session. */
export function isGymGearExercise(ex: Pick<CatalogExercise, "equipment">): boolean {
  return ex.equipment.includes("machine") || ex.equipment.includes("barbell");
}

/** Patterns that count as "main strength work" for the gym-gear floor. */
const STRENGTH_PATTERNS: ReadonlySet<ExercisePattern> = new Set([
  "squat",
  "hinge",
  "lunge",
  "push",
  "pull",
  "isolation",
]);

/** A gym/both program must put at least this share of its known-id strength
 * exercises on gym gear — below it, the plan reads like a home plan. */
export const GYM_GEAR_SHARE_FLOOR = 0.5;

/**
 * Ordered home substitutes per exercise id — the first candidate that is
 * legal for the trainee's declared home tools (and pregnancy-safe when that
 * is required) wins. Used both to repair an illegal home exercise and to fill
 * a missing/illegal home variant in a «كلاهما» program.
 */
export const HOME_SUBSTITUTE: Readonly<Record<string, readonly string[]>> = {
  // Squat / legs
  leg_press: ["goblet_squat", "squat"],
  barbell_back_squat: ["goblet_squat", "squat"],
  leg_extension: ["split_squat", "wall_sit", "squat"],
  leg_curl: ["romanian_deadlift", "glute_bridge"],
  barbell_deadlift: ["romanian_deadlift", "glute_bridge"],
  barbell_hip_thrust: ["hip_thrust", "glute_bridge"],
  hip_abduction: ["glute_bridge", "lunge"],
  cable_glute_kickback: ["glute_bridge", "hip_thrust"],
  seated_calf_raise: ["calf_raise"],
  goblet_squat: ["squat"],
  romanian_deadlift: ["glute_bridge"],
  step_up: ["lunge"],
  // Push
  barbell_bench_press: ["db_bench_press", "pushup", "knee_pushup", "wall_pushup"],
  chest_press_machine: ["db_bench_press", "pushup", "knee_pushup", "wall_pushup"],
  shoulder_press_machine: ["overhead_press", "wall_pushup"],
  db_bench_press: ["pushup", "knee_pushup", "wall_pushup"],
  overhead_press: ["wall_pushup"],
  cable_lateral_raise: ["lateral_raise"],
  triceps_pushdown: ["triceps_extension", "bench_dips"],
  triceps_extension: ["bench_dips"],
  // Pull
  seated_cable_row: ["one_arm_db_row", "bent_over_row", "band_row", "towel_row"],
  lat_pulldown: ["band_row", "towel_row"],
  assisted_pullup: ["band_row", "towel_row"],
  one_arm_db_row: ["band_row", "towel_row"],
  bent_over_row: ["band_row", "towel_row"],
  band_row: ["towel_row"],
  face_pull: ["towel_row"],
  reverse_pec_deck: ["rear_delt_fly", "face_pull", "towel_row"],
  rear_delt_fly: ["face_pull", "towel_row"],
  cable_biceps_curl: ["biceps_curl", "hammer_curl", "towel_row"],
  biceps_curl: ["towel_row"],
  hammer_curl: ["towel_row"],
  lateral_raise: ["wall_pushup"],
  band_pull_apart: ["arm_circles"],
  // Cardio machines
  incline_walk: ["brisk_walk"],
  stationary_bike: ["brisk_walk", "march_in_place"],
  rowing_machine: ["brisk_walk", "march_in_place"],
  elliptical: ["brisk_walk", "march_in_place"],
};

/**
 * Last-resort repair per movement pattern. Each list contains an entry legal
 * for ANY home profile (equipment-free or furniture-only) and a
 * pregnancy-safe one, so `pickSubstitute` always resolves.
 */
export const PATTERN_STAPLES: Readonly<Record<ExercisePattern, readonly string[]>> = {
  squat: ["squat", "wall_sit"],
  hinge: ["glute_bridge", "romanian_deadlift", "pelvic_tilt"],
  lunge: ["lunge", "split_squat"],
  push: ["knee_pushup", "wall_pushup", "pushup"],
  pull: ["towel_row", "band_row"],
  core: ["bird_dog", "plank", "dead_bug"],
  isolation: ["calf_raise", "lateral_raise"],
  mobility: ["arm_circles", "cat_cow", "hip_circles"],
  stretch: ["hamstring_stretch", "child_pose"],
  cardio: ["march_in_place", "brisk_walk"],
};

/**
 * Deterministic gym upgrades — bodyweight/band staples a gym session should
 * outgrow, mapped to their club siblings. Applied only in repair mode, only
 * on non-pregnant/non-early-postpartum trainees, and only until the gym-gear
 * floor is met. Dumbbell moves are legitimate gym training and stay put.
 */
export const GYM_UPGRADE: Readonly<Record<string, string>> = {
  pushup: "chest_press_machine",
  knee_pushup: "chest_press_machine",
  wall_pushup: "chest_press_machine",
  squat: "leg_press",
  wall_sit: "leg_extension",
  glute_bridge: "barbell_hip_thrust",
  band_row: "seated_cable_row",
  towel_row: "seated_cable_row",
  face_pull: "reverse_pec_deck",
  rear_delt_fly: "reverse_pec_deck",
  calf_raise: "seated_calf_raise",
  triceps_extension: "triceps_pushdown",
};

/** First substitute for `originalId` legal under `allowed` (and pregnancy-safe
 * when required). Falls back to the original's pattern staples. */
export function pickSubstitute(
  originalId: string,
  allowed: ReadonlySet<string>,
  requirePregnancySafe: boolean,
): string | null {
  const original = EXERCISE_BY_ID.get(originalId);
  const candidates = [
    ...(HOME_SUBSTITUTE[originalId] ?? []),
    ...(original ? PATTERN_STAPLES[original.pattern] : []),
  ];
  for (const id of candidates) {
    if (id === originalId || !allowed.has(id)) continue;
    const ex = EXERCISE_BY_ID.get(id);
    if (!ex) continue;
    if (requirePregnancySafe && !ex.pregnancy_safe) continue;
    return id;
  }
  return null;
}

export interface ProfileFitFlags {
  /** Pregnant trainees: substitutions must stay pregnancy-safe and the
   * gym-gear floor is waived (safety rules govern their programming). */
  pregnant: boolean;
  /** 0-3 months postpartum: same waiver as pregnancy. */
  recentPostpartum: boolean;
}

export interface ProfileFitResult {
  /** Cleaned/repaired member — always safe to use. */
  member: MemberWorkout;
  /** Re-roll-worthy problems found in the ORIGINAL member (before repair). */
  violations: string[];
  /** Substitutions/upgrades applied while repairing. */
  replacements: Array<{ from: string; to: string; kind: "substitute" | "upgrade" | "variant" }>;
  /** False when a gym/both program still misses the gym-gear floor after
   * repair (accepted + logged, never fatal). */
  gymShareOk: boolean;
}

/** Rewrite an exercise as `id` from the catalog, keeping the programming
 * (sets/reps/rest/RIR) and dropping prose written for the old movement. */
function asCatalogExercise(ex: WorkoutExercise, id: string): WorkoutExercise {
  const cat = EXERCISE_BY_ID.get(id);
  if (!cat) return ex;
  return {
    ...ex,
    exercise_id: id,
    name_ar: cat.name_ar,
    name_en: cat.name_en,
    target_muscles_ar: cat.target_muscles_ar,
    notes_ar: null,
  };
}

function strengthGymStats(member: MemberWorkout): { strength: number; gymGear: number } {
  let strength = 0;
  let gymGear = 0;
  for (const session of member.weekly_sessions) {
    for (const ex of session.exercises) {
      if (!ex.exercise_id) continue;
      const cat = EXERCISE_BY_ID.get(ex.exercise_id);
      if (!cat || !STRENGTH_PATTERNS.has(cat.pattern)) continue;
      strength += 1;
      if (isGymGearExercise(cat)) gymGear += 1;
    }
  }
  return { strength, gymGear };
}

/**
 * Diagnose AND repair a member's program against their workout profile.
 * The returned member always has the cleanups applied; `violations` reports
 * what the MODEL got wrong so the caller can re-roll instead of shipping the
 * repair (the repair is the final-attempt fallback).
 *
 * Exercises whose exercise_id is null (off-catalog output already nulled by
 * normalizeExerciseIds) are unverifiable and left untouched.
 */
export function enforceWorkoutProfileFit(
  member: MemberWorkout,
  profile: WorkoutProfile,
  flags: ProfileFitFlags,
): ProfileFitResult {
  const allowed = allowedExerciseIds(profile);
  const homeAllowed = profile.location === "both" ? homeAllowedIds(profile) : null;
  const safeOnly = flags.pregnant;
  const violations: string[] = [];
  const replacements: ProfileFitResult["replacements"] = [];

  const sessions = member.weekly_sessions.map((session) => ({
    ...session,
    exercises: session.exercises.map((original) => {
      let ex = original;

      // 1) The exercise itself must be legal for the location/tools.
      if (ex.exercise_id && !allowed.has(ex.exercise_id)) {
        violations.push(`disallowed:${ex.exercise_id}`);
        const sub = pickSubstitute(ex.exercise_id, allowed, safeOnly);
        if (sub) {
          replacements.push({ from: ex.exercise_id, to: sub, kind: "substitute" });
          ex = asCatalogExercise(ex, sub);
        } else {
          // No legal stand-in (should be unreachable — pattern staples cover
          // every home profile): drop the id so at least no impossible
          // animation/name pairing ships.
          ex = { ...ex, exercise_id: null };
        }
      }

      // 2) Home variants: only a «كلاهما» program carries them.
      if (!homeAllowed) {
        if (ex.home_variant_ar != null || ex.home_variant_id != null) {
          ex = { ...ex, home_variant_ar: null, home_variant_id: null };
        }
        return ex;
      }

      // 3) «كلاهما»: every gym-gear exercise needs a home variant legal for
      // the declared home tools.
      const cat = ex.exercise_id ? EXERCISE_BY_ID.get(ex.exercise_id) : undefined;
      const needsVariant = !!cat && !homeAllowed.has(cat.id);
      const variantLegal = ex.home_variant_id != null && homeAllowed.has(ex.home_variant_id);
      if (needsVariant && !variantLegal) {
        violations.push(
          ex.home_variant_id ? `variant_disallowed:${ex.home_variant_id}` : `variant_missing:${cat.id}`,
        );
        const sub = pickSubstitute(cat.id, homeAllowed, safeOnly);
        if (sub) {
          const subCat = EXERCISE_BY_ID.get(sub)!;
          replacements.push({ from: ex.home_variant_id ?? cat.id, to: sub, kind: "variant" });
          ex = { ...ex, home_variant_id: sub, home_variant_ar: subCat.name_ar };
        } else {
          ex = { ...ex, home_variant_id: null };
        }
      } else if (!needsVariant && ex.home_variant_id != null && !homeAllowed.has(ex.home_variant_id)) {
        // Main move already works at home; an illegal variant is just noise.
        violations.push(`variant_disallowed:${ex.home_variant_id}`);
        ex = { ...ex, home_variant_id: null, home_variant_ar: null };
      }
      return ex;
    }),
  }));

  let repaired: MemberWorkout = { ...member, weekly_sessions: sessions };

  // 4) Gym-gear floor: a club program that reads like a home plan is exactly
  // the mismatch this layer exists to stop.
  let gymShareOk = true;
  const floorApplies =
    (profile.location === "gym" || profile.location === "both") &&
    !flags.pregnant &&
    !flags.recentPostpartum;
  if (floorApplies) {
    const before = strengthGymStats(repaired);
    if (before.strength > 0 && before.gymGear / before.strength < GYM_GEAR_SHARE_FLOOR) {
      violations.push(
        `gym_share_low:${before.gymGear}/${before.strength}`,
      );
      // Repair: upgrade bodyweight/band staples to their club siblings, in
      // session order, until the floor holds.
      let { strength, gymGear } = before;
      const upgraded = repaired.weekly_sessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((ex) => {
          if (gymGear / strength >= GYM_GEAR_SHARE_FLOOR) return ex;
          const target = ex.exercise_id ? GYM_UPGRADE[ex.exercise_id] : undefined;
          if (!ex.exercise_id || !target) return ex;
          replacements.push({ from: ex.exercise_id, to: target, kind: "upgrade" });
          gymGear += 1;
          let next = asCatalogExercise(ex, target);
          // The upgrade is gym-only by construction — a «كلاهما» program
          // keeps a legal home variant for it.
          if (homeAllowed && !homeAllowed.has(target)) {
            const sub = pickSubstitute(target, homeAllowed, safeOnly);
            const subCat = sub ? EXERCISE_BY_ID.get(sub) : undefined;
            next = {
              ...next,
              home_variant_id: sub,
              home_variant_ar: subCat ? subCat.name_ar : null,
            };
          }
          return next;
        }),
      }));
      repaired = { ...repaired, weekly_sessions: upgraded };
      const after = strengthGymStats(repaired);
      gymShareOk =
        after.strength === 0 || after.gymGear / after.strength >= GYM_GEAR_SHARE_FLOOR;
    }
  }

  return { member: repaired, violations, replacements, gymShareOk };
}
