"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, UtensilsCrossed, Loader2 } from "lucide-react";
import { finishOnboardingToSubscription } from "../actions";

/** The meals-only vs meals+workout fork at the end of onboarding. */
export function PlanScopeChoice() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"meals" | "both" | null>(null);

  const go = (picked: "meals" | "both") => {
    setChoice(picked);
    if (picked === "both") {
      router.push("/onboarding/workout");
      return;
    }
    startTransition(() => finishOnboardingToSubscription());
  };

  const card =
    "w-full rounded-3xl border-2 bg-white p-6 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 disabled:opacity-60";

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={isPending}
        onClick={() => go("both")}
        className={`${card} border-brand-purple-900/30 hover:border-brand-purple-900`}
      >
        <span className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand-lavender/40 mb-3">
          <Dumbbell className="size-6 text-brand-purple-900" aria-hidden="true" />
        </span>
        <span className="block font-extrabold text-xl text-brand-ink">
          وجبات وتمارين معاً
        </span>
        <span className="mt-1 block text-brand-ink-muted text-sm leading-relaxed">
          سبعة أسئلة إضافية قصيرة، وننشئ خطة الوجبات وبرنامج التمارين في خطوة واحدة.
        </span>
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => go("meals")}
        className={`${card} border-brand-ink/10 hover:border-brand-ink/25`}
      >
        <span className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand-surface mb-3">
          {isPending && choice === "meals" ? (
            <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-brand-ink" aria-hidden="true" />
          ) : (
            <UtensilsCrossed className="size-6 text-brand-ink" aria-hidden="true" />
          )}
        </span>
        <span className="block font-extrabold text-xl text-brand-ink">
          خطة الوجبات فقط
        </span>
        <span className="mt-1 block text-brand-ink-muted text-sm leading-relaxed">
          نبدأ بالوجبات الآن، ويمكنك إضافة خطة التمارين لاحقاً من لوحة التحكم.
        </span>
      </button>
    </div>
  );
}
