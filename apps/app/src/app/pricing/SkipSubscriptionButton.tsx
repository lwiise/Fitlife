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
    <div className="mt-10 max-w-md mx-auto text-center">
      {/* "or" divider — frames the free path as a deliberate alternative to the
          paid tiers, not fine print buried under the cards. */}
      <div className="flex items-center gap-3 mb-6" aria-hidden="true">
        <span className="h-px flex-1 bg-brand-ink/10" />
        <span className="text-brand-ink-muted text-sm font-bold">أو</span>
        <span className="h-px flex-1 bg-brand-ink/10" />
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => generateSoloAndContinue())}
        className="inline-flex w-full items-center justify-center gap-2 min-h-12 rounded-xl border-2 border-brand-purple-900 bg-white px-6 py-3.5 text-brand-purple-900 text-base font-bold transition-colors hover:bg-brand-lavender/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending && (
          <Loader2
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        أكملي بخطتك أنتِ فقط الآن — مجاناً
      </button>
      <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
        تقدرين تشتركين لاحقاً ونجهّز خطط باقي أفراد العائلة.
      </p>
    </div>
  );
}
