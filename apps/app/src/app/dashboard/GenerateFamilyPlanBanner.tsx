"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { generateFamilyPlan } from "@/app/onboarding/actions";

/**
 * Shown when the household has more members than the current plan covers (e.g.
 * a member was added but the plan couldn't regenerate until the tier was
 * upgraded). One click generates the coordinated family plan; if the tier still
 * can't cover them, routes to pricing.
 */
export function GenerateFamilyPlanBanner({ names }: { names: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const one = names.length === 1 ? names[0] : null;
  const headline = one
    ? `أضفتِ ${one} — أنشئي خطته الغذائية ضمن خطط العائلة المنسقة.`
    : `أضفتِ ${names.length} أفراد جدد — أنشئي خططهم الغذائية ضمن خطط العائلة المنسقة.`;
  const buttonLabel = one ? `أنشئي خطة ${one}` : "أنشئي الخطط";

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateFamilyPlan();
      if (result.ok) {
        // Carry the member's name so the generating screen shows it, not Mom's.
        router.push(one ? `/plan?member=${encodeURIComponent(one)}` : "/plan");
        return;
      }
      if ("upgrade_required" in result) {
        router.push("/pricing");
        return;
      }
      setError(result.error);
    });
  };

  return (
    <div className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-4 mb-6">
      <div className="flex items-start gap-3">
        <Users className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-brand-ink text-sm font-medium leading-relaxed">
            {headline}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-11"
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {buttonLabel}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-red-700 text-sm leading-relaxed">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
