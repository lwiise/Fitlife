"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { saveProfileStep, saveFamilyMembers, completeOnboarding } from "./actions";
import type { OnboardingState } from "./schema";

import { Step1Identity } from "./steps/Step1Identity";
import { Step2Physical } from "./steps/Step2Physical";
import { Step3Goal } from "./steps/Step3Goal";
import { Step4FamilyComposition } from "./steps/Step4FamilyComposition";
import { Step5MemberDetails } from "./steps/Step5MemberDetails";
import { Step6Dietary } from "./steps/Step6Dietary";
import { Step7Cuisine } from "./steps/Step7Cuisine";
import { Step8Medical } from "./steps/Step8Medical";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const TOTAL_STEPS = 8;

type ActionResult = { ok: true } | { ok: false; error: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OnboardingWizard({
  initialProfile: _initialProfile,
  tierLimit,
}: {
  initialProfile: Profile;
  tierLimit: number | null;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({});
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goNext = () => {
    setSubmitError(null);
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setSubmitError(null);
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStepComplete = async (stepNumber: number, data: any) => {
    const newState = { ...state, [`step${stepNumber}`]: data };
    setState(newState);

    startTransition(async () => {
      let result: ActionResult = { ok: true };

      if (stepNumber === 1) {
        result = await saveProfileStep({
          display_name: data.display_name,
          birth_year: data.birth_year,
        });
      } else if (stepNumber === 2) {
        result = await saveProfileStep({
          height_cm: data.height_cm,
          weight_kg: data.weight_kg,
          activity_level: data.activity_level,
        });
      } else if (stepNumber === 3) {
        result = await saveProfileStep({ primary_goal: data.primary_goal });
      } else if (stepNumber === 5) {
        result = await saveFamilyMembers(data.members);
      } else if (stepNumber === 6) {
        result = await saveProfileStep({
          dietary_restrictions: data.family_dietary_restrictions,
        });
      } else if (stepNumber === 7) {
        result = await saveProfileStep({ cuisine_preference: data.cuisine_preference });
      } else if (stepNumber === 8) {
        result = await saveProfileStep({
          has_medical_conditions: data.has_medical_conditions,
          medical_conditions: data.medical_conditions,
          is_pregnant: data.is_pregnant,
          pregnancy_trimester: data.pregnancy_trimester ?? null,
          consulted_doctor: data.consulted_doctor,
        });
      }

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      if (stepNumber === TOTAL_STEPS) {
        await completeOnboarding();
      } else {
        goNext();
      }
    });
  };

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base text-brand-ink">إعداد خطتك</h1>
            <span
              className="text-brand-ink-muted text-xs font-medium tabular-nums"
              aria-label={`الخطوة ${currentStep} من ${TOTAL_STEPS}`}
            >
              {currentStep} / {TOTAL_STEPS}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {currentStep === 1 && (
              <Step1Identity
                defaultValues={state.step1}
                onSubmit={(data) => handleStepComplete(1, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 2 && (
              <Step2Physical
                defaultValues={state.step2}
                onSubmit={(data) => handleStepComplete(2, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 3 && (
              <Step3Goal
                defaultValues={state.step3}
                onSubmit={(data) => handleStepComplete(3, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 4 && (
              <Step4FamilyComposition
                defaultValues={state.step4}
                tierLimit={tierLimit}
                onSubmit={(data) => {
                  setState((s) => ({ ...s, step4: data }));
                  goNext();
                }}
                isPending={isPending}
              />
            )}
            {currentStep === 5 && state.step4 && (
              <Step5MemberDetails
                composition={state.step4}
                defaultValues={state.step5}
                onSubmit={(data) => handleStepComplete(5, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 6 && (
              <Step6Dietary
                defaultValues={state.step6}
                onSubmit={(data) => handleStepComplete(6, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 7 && (
              <Step7Cuisine
                defaultValues={state.step7}
                onSubmit={(data) => handleStepComplete(7, data)}
                isPending={isPending}
              />
            )}
            {currentStep === 8 && (
              <Step8Medical
                defaultValues={state.step8}
                onSubmit={(data) => handleStepComplete(8, data)}
                isPending={isPending}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <p className="text-red-700 text-sm leading-relaxed">{submitError}</p>
          </div>
        )}

        {currentStep > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isPending}
            className="mt-6 inline-flex items-center gap-1 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface rounded-md"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            رجوع
          </button>
        )}
      </div>
    </main>
  );
}
