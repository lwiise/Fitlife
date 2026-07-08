import { z } from "zod";
import { EXERCISE_BY_ID } from "./exerciseCatalog";

// ─── Workout questionnaire (the 7 opt-in answers) ──────────────────────────
// Stored as profiles.workout_profile / family_members.workout_profile jsonb
// (00014). null column = not opted in. Zod owns the shape.

export const WorkoutProfileSchema = z.object({
  location: z.enum(["home", "gym", "both"]),
  equipment: z.array(z.enum(["none", "dumbbells", "bands", "machines"])).default([]),
  injuries: z.array(z.enum(["shoulder", "knee", "back", "other"])).default([]),
  injury_notes: z.string().trim().max(300).nullish(),
  desired_days: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  focus_areas: z
    .array(
      z.enum([
        "full_body",
        "core",
        "lower_glutes",
        "strength",
        "endurance",
        "definition",
        "balanced",
      ]),
    )
    .min(1),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  session_minutes: z.enum(["m20_30", "m30_45", "m45_60"]),
});

export type WorkoutProfile = z.infer<typeof WorkoutProfileSchema>;

/**
 * Deterministic split recommendation by desired training days — the
 * evidence-based defaults the methodology instructs the model to follow.
 * Computed in code so tests (and the prompt) never depend on inference.
 */
export function splitForDays(days: 3 | 4 | 5 | 6): string {
  switch (days) {
    case 3:
      return "جسم كامل ×3 (يوم راحة بين الجلسات)";
    case 4:
      return "علوي/سفلي ×2";
    case 5:
      return "علوي/سفلي + دفع/سحب/أرجل";
    case 6:
      return "دفع/سحب/أرجل ×2";
  }
}

// ─── Generated plan shape (mirrors the meal plan's schema discipline) ──────

export const WorkoutExerciseSchema = z.object({
  // Catalog id (exerciseCatalog.ts) driving the form animation. Nullish so
  // pre-catalog plans keep parsing; unknown ids are nulled post-parse by
  // normalizeExerciseIds (log-only — never fails a run).
  exercise_id: z.string().nullish(),
  name_ar: z.string().min(1),
  name_en: z.string().nullish(),
  target_muscles_ar: z.string().min(1),
  sets: z.number().int().min(1).max(8),
  // String to allow ranges and time-based work: "8-12", "30 ثانية", "12 لكل جهة".
  reps: z.string().min(1),
  rest_seconds: z.number().int().min(15).max(300),
  // RIR effort note, e.g. "أبقي 2-3 عدّات في الخزان".
  rir: z.string().nullish(),
  // Home substitution when the member trains in both locations.
  home_variant_ar: z.string().nullish(),
  // Catalog id for the home substitution's animation (must be home_ok).
  home_variant_id: z.string().nullish(),
  notes_ar: z.string().nullish(),
});

export const WorkoutSessionSchema = z.object({
  day_index: z.number().int().min(0).max(6),
  session_name_ar: z.string().min(1),
  warmup_ar: z.array(z.string()).min(1),
  exercises: z.array(WorkoutExerciseSchema).min(1),
  cooldown_ar: z.array(z.string()).default([]),
  duration_min: z.number().int().min(10).max(120),
});

export const MemberWorkoutSchema = z.object({
  member_id: z.string().min(1),
  member_name_ar: z.string().min(1),
  split_name_ar: z.string().min(1),
  // max(7): tolerate an off-by-one week from the model; normalizeMemberSessions
  // caps to the trainee's desired_days deterministically after parse.
  weekly_sessions: z.array(WorkoutSessionSchema).min(1).max(7),
  progression_notes_ar: z.string().min(1),
  cardio_notes_ar: z.string().nullish(),
  safety_notes_ar: z.string().nullish(),
});

export const WorkoutPlanSchema = z.object({
  week_start_date: z.string(),
  members: z.array(MemberWorkoutSchema).min(1),
  methodology_notes_ar: z.string().nullish(),
  safety_disclaimer_ar: z.string().nullish(),
  // Progressive-render fields (same contract as MealPlanSchema).
  generating: z.boolean().optional(),
  gen_attempts: z.record(z.string(), z.number()).optional(),
});

export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
export type MemberWorkout = z.infer<typeof MemberWorkoutSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

/** Skeleton (phase 1): split + named sessions only — no exercises yet. */
export const WorkoutSkeletonSchema = z.object({
  members: z
    .array(
      z.object({
        member_id: z.string().min(1),
        member_name_ar: z.string().min(1),
        split_name_ar: z.string().min(1),
        // max(7): tolerate an over-emitted week (the model sometimes counts
        // rest/walk days as sessions); normalizeWorkoutSkeleton caps to the
        // trainee's desired_days deterministically after parse.
        sessions: z
          .array(
            z.object({
              day_index: z.number().int().min(0).max(6),
              session_name_ar: z.string().min(1),
              main_patterns_ar: z.array(z.string()).min(1),
            }),
          )
          .min(1)
          .max(7),
        safety_flags_ar: z.array(z.string()).optional(),
      }),
    )
    .min(1),
  safety_disclaimer_ar: z.string(),
});

export type WorkoutSkeleton = z.infer<typeof WorkoutSkeletonSchema>;

/** True iff some member has some session with at least one exercise. */
export function workoutPlanHasContent(plan: WorkoutPlan): boolean {
  return plan.members.some((m) =>
    m.weekly_sessions.some((s) => s.exercises.length > 0),
  );
}

/**
 * Deterministic cleanup of a parsed skeleton: per member, sort sessions by
 * day_index, drop duplicate day_index entries (keep the first), and cap the
 * count at the trainee's desired_days (fallback 6). The model occasionally
 * over-emits — e.g. lists rest or walking days as sessions — and shape
 * problems must never kill a run that code can repair.
 */
export function normalizeWorkoutSkeleton(
  skeleton: WorkoutSkeleton,
  desiredDaysById: Record<string, number | undefined>,
): WorkoutSkeleton {
  return {
    ...skeleton,
    members: skeleton.members.map((m) => ({
      ...m,
      sessions: normalizeSessionList(m.sessions, desiredDaysById[m.member_id]),
    })),
  };
}

/** Same cleanup for an expanded member's weekly sessions. */
export function normalizeMemberSessions<T extends { day_index: number }>(
  sessions: T[],
  desiredDays: number | undefined,
): T[] {
  return normalizeSessionList(sessions, desiredDays);
}

/**
 * Null out exercise/home-variant ids that aren't in the approved catalog so
 * the viewer never requests a nonexistent animation file. Returns the count
 * of unknown ids so the caller can log (non-fatal, mirrors the cookbook
 * deviation guard's log-only stance).
 */
export function normalizeExerciseIds(member: MemberWorkout): {
  member: MemberWorkout;
  unknownIds: string[];
} {
  const unknownIds: string[] = [];
  const check = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (EXERCISE_BY_ID.has(id)) return id;
    unknownIds.push(id);
    return null;
  };
  const normalized: MemberWorkout = {
    ...member,
    weekly_sessions: member.weekly_sessions.map((s) => ({
      ...s,
      exercises: s.exercises.map((ex) => ({
        ...ex,
        exercise_id: check(ex.exercise_id),
        home_variant_id: check(ex.home_variant_id),
      })),
    })),
  };
  return { member: normalized, unknownIds };
}

function normalizeSessionList<T extends { day_index: number }>(
  sessions: T[],
  desiredDays: number | undefined,
): T[] {
  const cap = desiredDays && desiredDays >= 1 ? Math.min(desiredDays, 6) : 6;
  const seen = new Set<number>();
  const out: T[] = [];
  for (const session of [...sessions].sort((a, b) => a.day_index - b.day_index)) {
    if (seen.has(session.day_index)) continue;
    seen.add(session.day_index);
    out.push(session);
    if (out.length >= cap) break;
  }
  return out;
}
