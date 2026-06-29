"use client";

// Standalone "edit exercise inputs" wizard, reached from the /profile and
// /family/edit/[memberId] hubs. It REUSES the onboarding exercise step machinery
// (ExerciseStepView + useExerciseProfile + exercisePrescriptionSteps +
// buildExerciseProfile) rather than duplicating the form — only the orchestration
// shell here differs from the onboarding MomExerciseWizard: it always starts opted
// in (seeded from the stored profile), has no opt-in step, and persists via an
// injected `save` action, returning to the hub. buildExerciseProfile re-runs the
// §4 safety screen, so an edited answer can raise/lower clearance on save.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { CARDIO_MED_CONDITION_SLUGS } from "@/lib/exercise/constants";
import {
  useExerciseProfile,
  buildExerciseProfile,
  exerciseStateFromProfile,
} from "@/components/exercise/useExerciseProfile";
import { exercisePrescriptionSteps } from "@/components/exercise/exerciseSteps";
import { ExerciseStepView } from "@/components/exercise/ExerciseStepView";
import type { ExerciseProfile } from "@/lib/exercise/types";

// Reused meal-profile fields (read from the saved row) — never re-asked, only used
// to assemble + screen. `member_type` may be child here (the member hub allows it).
export interface ExerciseEditReused {
  member_type: "adult" | "child" | "pregnant" | "lactating";
  age: number;
  activity_level: string | null;
  conditions: string[];
  goalIsSpecific: boolean;
}

export function ExerciseEditWizard({
  reused,
  initialProfile,
  save,
  doneHref,
  cancelHref,
}: {
  reused: ExerciseEditReused;
  initialProfile: ExerciseProfile;
  save: (
    profile: ExerciseProfile,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  doneHref: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  // Seed from the stored profile; always opted in (the edit entry only appears for
  // opted-in members, and this flow edits — never removes — the opt-in).
  const ex = useExerciseProfile(exerciseStateFromProfile(initialProfile));
  const prefersReduced = useReducedMotion();

  const steps = exercisePrescriptionSteps(
    {
      member_type: reused.member_type,
      goalIsSpecific: reused.goalIsSpecific,
      age: reused.age,
      hasCardioCondition: reused.conditions.some((c) =>
        CARDIO_MED_CONDITION_SLUGS.has(c),
      ),
      hasAnyCondition: reused.conditions.length > 0,
    },
    ex.state,
  );
  const total = steps.length;
  const key = steps[Math.min(step, total - 1)];
  const isFinalStep = step === total - 1;

  const cancel = () => router.push(cancelHref);
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = () => {
    const profile = buildExerciseProfile(ex.state, {
      member_type: reused.member_type,
      age: reused.age,
      activity_level: reused.activity_level,
      conditions: reused.conditions,
    });
    // optedIn is always true here → profile is non-null; the guard is defensive.
    if (!profile) {
      cancel();
      return;
    }
    startTransition(async () => {
      const result = await save(profile);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(doneHref);
    });
  };

  const advanceOrSubmit = () => {
    setError(null);
    if (step < total - 1) setStep((s) => s + 1);
    else submit();
  };

  if (!key) {
    // No prescription steps for this member (defensive) — nothing to edit.
    cancel();
    return null;
  }

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base text-brand-ink">تعديل خطة التمارين</h1>
            <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
              {step + 1} / {total}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-label="تقدّم خطوات تعديل خطة التمارين"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={total}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${((step + 1) / total) * 100}%` }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            initial={{ opacity: 0, x: prefersReduced ? 0 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReduced ? 0 : -30 }}
            transition={{ duration: prefersReduced ? 0 : 0.3, ease: "easeOut" }}
          >
            <ExerciseStepView
              stepKey={key}
              ex={ex}
              onNext={advanceOrSubmit}
              primaryLabel={isFinalStep ? "احفظي التعديلات" : "التالي"}
              isPending={isPending && isFinalStep}
            />
          </motion.div>
        </AnimatePresence>

        {error && (
          <div role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={step > 0 ? goBack : cancel}
          disabled={isPending}
          className="mt-6 inline-flex items-center gap-1 px-3 py-2 min-h-[44px] -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
          {step > 0 ? "رجوع" : "إلغاء"}
        </button>
      </div>
    </main>
  );
}
