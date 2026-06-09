"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { generateSoloAndContinue } from "@/app/onboarding/actions";

/**
 * Post-onboarding "continue with just my plan" escape from the subscription screen.
 * Generates the primary user's plan only (the trial tier caps to one person) and
 * sends her to /plan. She can subscribe later to unlock the rest of the family.
 */
export function SkipSubscriptionButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="text-center mt-8">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => generateSoloAndContinue())}
        className="inline-flex items-center justify-center gap-2 min-h-11 text-brand-ink-muted hover:text-brand-ink text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending && (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        أكملي بخطتك أنتِ فقط الآن
      </button>
      <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed">
        تقدرين تشتركين لاحقاً ونجهّز خطط باقي أفراد العائلة.
      </p>
    </div>
  );
}
