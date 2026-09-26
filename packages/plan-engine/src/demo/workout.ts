/**
 * Demo-mode workout replies (skeleton + per-member week), built from the
 * exercise catalog and each trainee's own profile. The member program is passed
 * through the engine's own location/equipment repair before it is returned, so
 * the engine's fit check accepts it on the first attempt instead of re-rolling.
 */

import type { WorkoutTrainee } from "../workout/systemPrompt";
import type { MemberWorkout, WorkoutExercise, WorkoutSkeleton } from "../workout/schema";
import { splitForDays } from "../workout/schema";
import { EXERCISE_CATALOG, type ExercisePattern } from "../workout/exerciseCatalog";
import {
  allowedExerciseIds,
  enforceWorkoutProfileFit,
  homeAllowedIds,
  isGymGearExercise,
  isInjuryContraindicated,
  HOME_SUBSTITUTE,
  type ProfileFitFlags,
} from "../workout/equipment";

type SessionKind = "full" | "upper" | "lower" | "push" | "pull" | "legs";

const KINDS_BY_DAYS: Record<3 | 4 | 5 | 6, SessionKind[]> = {
  3: ["full", "full", "full"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["upper", "lower", "push", "pull", "legs"],
  6: ["push", "pull", "legs", "push", "pull", "legs"],
};
const DEFAULT_DAYS: Record<3 | 4 | 5 | 6, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};
const KIND_NAME_AR: Record<SessionKind, string> = {
  full: "الجسم الكامل",
  upper: "الجزء العلوي",
  lower: "الجزء السفلي",
  push: "الدفع",
  pull: "السحب",
  legs: "الأرجل",
};
const KIND_PATTERNS: Record<SessionKind, ExercisePattern[]> = {
  full: ["squat", "push", "hinge", "pull", "core"],
  upper: ["push", "pull", "push", "pull", "core"],
  lower: ["squat", "hinge", "lunge", "isolation", "core"],
  push: ["push", "push", "isolation", "core"],
  pull: ["pull", "pull", "isolation", "core"],
  legs: ["squat", "hinge", "lunge", "isolation"],
};
const PATTERN_AR: Record<ExercisePattern, string> = {
  squat: "القرفصاء",
  hinge: "ثني الورك",
  lunge: "الطعنات",
  push: "الدفع",
  pull: "السحب",
  core: "الجذع",
  isolation: "تمارين العزل",
  mobility: "المرونة",
  stretch: "الإطالة",
  cardio: "الكارديو",
};

function sessionPlan(trainee: WorkoutTrainee): Array<{ day: number; kind: SessionKind }> {
  const n = trainee.profile.desired_days;
  const days = trainee.profile.preferred_days?.length === n
    ? trainee.profile.preferred_days
    : DEFAULT_DAYS[n];
  return KINDS_BY_DAYS[n].map((kind, i) => ({ day: days[i] ?? i, kind }));
}

export function demoWorkoutSkeletonReply(trainees: WorkoutTrainee[]): string {
  const skeleton: WorkoutSkeleton = {
    members: trainees.map((t) => ({
      member_id: t.member_id,
      member_name_ar: t.name,
      split_name_ar: splitForDays(t.profile.desired_days),
      sessions: sessionPlan(t).map((s, i) => ({
        day_index: s.day,
        session_name_ar: `${KIND_NAME_AR[s.kind]} (${i + 1})`,
        main_patterns_ar: KIND_PATTERNS[s.kind].map((p) => PATTERN_AR[p]),
      })),
    })),
    safety_disclaimer_ar:
      "برنامج تجريبي لأغراض العرض فقط. توقّفي عن أي تمرين يسبّب ألماً، واستشيري الطبيب قبل البدء.",
  };
  return JSON.stringify(skeleton);
}

function programming(experience: string): Pick<WorkoutExercise, "sets" | "reps" | "rest_seconds" | "rir"> {
  if (experience === "advanced") return { sets: 4, reps: "6-10", rest_seconds: 120, rir: "أبقي عدّة إلى عدّتين في الخزان" };
  if (experience === "intermediate") return { sets: 3, reps: "8-12", rest_seconds: 90, rir: "أبقي عدّتين في الخزان" };
  return { sets: 3, reps: "10-12", rest_seconds: 75, rir: "أبقي عدّتين إلى ثلاث في الخزان" };
}

const DURATION: Record<string, number> = { m20_30: 30, m30_45: 40, m45_60: 55 };

export function demoWorkoutMemberReply(
  trainee: WorkoutTrainee,
  flags: ProfileFitFlags,
): string {
  const profile = trainee.profile;
  const allowed = allowedExerciseIds(profile);
  const home = profile.location === "both" ? homeAllowedIds(profile) : null;
  const wantsGym = profile.location !== "home" && !flags.pregnant && !flags.recentPostpartum;
  const legal = (id: string) =>
    allowed.has(id) &&
    !isInjuryContraindicated(id, profile.injuries) &&
    (!flags.pregnant || EXERCISE_CATALOG.find((e) => e.id === id)?.pregnancy_safe);
  const prog = programming(profile.experience);

  const sessions = sessionPlan(trainee).map((s, i) => {
    const used = new Set<string>();
    const exercises: WorkoutExercise[] = [];
    for (const pattern of KIND_PATTERNS[s.kind]) {
      const candidates = EXERCISE_CATALOG.filter(
        (e) => e.pattern === pattern && !used.has(e.id) && legal(e.id),
      );
      // Gym trainees get gym gear first (the engine's gym-share floor); home
      // trainees only ever see home-legal ids (allowedExerciseIds).
      candidates.sort((a, b) =>
        wantsGym ? Number(isGymGearExercise(b)) - Number(isGymGearExercise(a)) : 0,
      );
      // Rotate by session so repeated session kinds don't repeat every movement.
      const pick = candidates[i % Math.max(1, candidates.length)];
      if (!pick) continue;
      used.add(pick.id);
      const variant =
        home && !pick.home_ok
          ? (HOME_SUBSTITUTE[pick.id] ?? []).find((id) => home.has(id)) ?? null
          : null;
      exercises.push({
        exercise_id: pick.id,
        name_ar: pick.name_ar,
        name_en: pick.name_en,
        target_muscles_ar: pick.target_muscles_ar,
        ...(pattern === "core" ? { ...prog, reps: "30 ثانية" } : prog),
        home_variant_id: variant,
        home_variant_ar: variant
          ? EXERCISE_CATALOG.find((e) => e.id === variant)?.name_ar ?? null
          : null,
        notes_ar: null,
      });
    }
    return {
      day_index: s.day,
      session_name_ar: `${KIND_NAME_AR[s.kind]} (${i + 1})`,
      warmup_ar: ["خمس دقائق مشي خفيف أو دراجة ثابتة", "تحريك الكتفين والوركين والكاحلين"],
      exercises,
      cooldown_ar: ["إطالة هادئة للعضلات التي عملت، خمس دقائق"],
      duration_min: DURATION[profile.session_minutes] ?? 40,
    };
  });

  const member: MemberWorkout = {
    member_id: trainee.member_id,
    member_name_ar: trainee.name,
    split_name_ar: splitForDays(profile.desired_days),
    weekly_sessions: sessions.filter((s) => s.exercises.length > 0),
    progression_notes_ar:
      "برنامج تجريبي: زيدي الوزن أو العدّات قليلاً كل أسبوع حين تصبح آخر مجموعة سهلة.",
    cardio_notes_ar: "مشي سريع ثلاثين دقيقة في أيام الراحة.",
    safety_notes_ar: null,
  };
  return JSON.stringify(enforceWorkoutProfileFit(member, profile, flags).member);
}
