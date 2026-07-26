"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { generateSoloAndContinue } from "@/app/onboarding/actions";

/**
 * Post-onboarding "continue with just my plan" escape from the subscription screen.
 * Generates the primary user's plan only (the trial tier caps to one person) and
 * sends her to /plan. She can subscribe later to unlock the rest of the family.
 *
 * The action used to redirect unconditionally, so a refused generation (medical
 * gate, inactive subscription, dispatch failure) landed her on an empty plan page
 * with nothing to explain it. It now returns the reason and we stay put and show it.
 */
export function SkipSubscriptionButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateSoloAndContinue();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/plan");
      router.refresh();
    });
  };

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
        onClick={run}
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
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm leading-relaxed"
        >
          {error}
        </p>
      ) : (
        <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
          تقدرين تشتركين لاحقاً ونجهّز خطط باقي أفراد العائلة.
        </p>
      )}
    </div>
  );
}
