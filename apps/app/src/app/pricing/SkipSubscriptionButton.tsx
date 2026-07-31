"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { generateSoloAndContinue } from "@/app/onboarding/actions";
import { capture } from "@/lib/analytics";
import { genderPick } from "@/lib/copy/gender";

/**
 * How long the free path may sit on a bare spinner before we hand the user a way
 * out. The action is a chain of DB round-trips plus one background-function
 * dispatch, so a cold serverless container can legitimately take several
 * seconds — this is deliberately well past that, not a request timeout.
 */
const STALL_NOTICE_MS = 15_000;

/**
 * Post-onboarding "continue with just my plan" escape from the subscription screen.
 * Generates the primary user's plan only (the trial tier caps to one person) and
 * sends them to /plan. They can subscribe later to unlock the rest of the family.
 *
 * The action used to redirect unconditionally, so a refused generation (medical
 * gate, inactive subscription, dispatch failure) landed them on an empty plan page
 * with nothing to explain it. It now returns the reason and we stay put and show it.
 *
 * Pending state is a plain flag, NOT useTransition. Two reasons, both learned the
 * hard way from a funnel that dead-ended here:
 *   • `router.push()` was followed by `router.refresh()` inside the same
 *     transition. The refresh re-fetches the route being LEFT, and the spinner
 *     was bound to `isPending`, which only clears once the whole transition
 *     commits — so a stranded transition showed a spinner that never stopped,
 *     with no navigation and no error. Nothing else in the app pairs the two.
 *   • A transition cannot be cancelled, so there was no way to rescue a user
 *     whose action never settled. The flag lets the stall notice below fire.
 */
export function SkipSubscriptionButton({
  ownerSex,
}: {
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const g = genderPick(ownerSex);

  // Armed for as long as we're waiting — on the action AND on the navigation it
  // triggers. A successful push unmounts this page, so the cleanup is the normal
  // exit; the timer firing means we are genuinely still here with nothing to show.
  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setStalled(true), STALL_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  const run = async () => {
    setError(null);
    setStalled(false);
    setIsPending(true);
    // Two events, not one. This is THE business question — free path vs paid —
    // and the action genuinely refuses (medical gate, inactive subscription,
    // dispatch failure). Firing once on click would count every refusal as a
    // free-cohort member and overstate it; firing once on success would hide
    // demand that the product blocked. Intent and outcome are different
    // numbers, so `free_path_clicked` is the denominator and
    // `free_path_chosen` the numerator.
    capture("free_path_clicked");
    try {
      const result = await generateSoloAndContinue();
      if (!result.ok) {
        capture("free_path_refused");
        setError(result.error);
        setIsPending(false);
        return;
      }
      capture("free_path_chosen");
      // No router.refresh() chaser: /plan is a dynamic, auth-reading route, so
      // the push already fetches it fresh from the server. The refresh only ever
      // raced the navigation it followed.
      router.push("/plan");
      // Stay pending on purpose — the spinner should span the navigation, and
      // this component unmounts when it lands. If it does NOT land, the stall
      // notice above takes over instead of leaving a spinner forever.
    } catch {
      // A dropped connection or a platform-level 502 rejects the action call.
      // Unhandled, that surfaced as nothing at all — swallowed by the transition.
      // Its OWN event, not free_path_refused: the product did not refuse
      // anything here, and folding transport failures into the refusal count
      // would misread infrastructure noise as demand the product blocked.
      capture("free_path_error");
      setError(
        g(
          "تعذّر إكمال الطلب. حاولي مرة أخرى، أو افتحي صفحة الخطة لمتابعة الحالة.",
          "تعذّر إكمال الطلب. حاول مرة أخرى، أو افتح صفحة الخطة لمتابعة الحالة.",
        ),
      );
      setIsPending(false);
    }
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
        {g(
          "أكملي بخطتك أنتِ فقط الآن — مجاناً",
          "أكمل بخطتك أنتَ فقط الآن — مجاناً",
        )}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm leading-relaxed"
        >
          {error}
        </p>
      ) : stalled ? (
        // The dispatch may well have landed even though this page never moved —
        // the plan row is created before the background worker is called. So the
        // honest message is "check the plan page", not "it failed".
        <div
          role="status"
          className="mt-3 rounded-xl border border-brand-ink/10 bg-white px-4 py-3 text-start"
        >
          {/* Undiacritised «خطتك» reads for either owner, so no dual form. */}
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            التجهيز يأخذ وقتاً أطول من المعتاد. خطتك قد تكون قيد الإنشاء بالفعل.
          </p>
          <Link
            href="/plan"
            className="mt-2 inline-flex min-h-11 items-center font-bold text-brand-purple-900 text-sm underline underline-offset-4 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            {g("افتحي صفحة الخطة", "افتح صفحة الخطة")}
          </Link>
        </div>
      ) : (
        <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
          {g(
            "تقدرين تشتركين لاحقاً ونجهّز خطط باقي أفراد العائلة.",
            "تقدر تشترك لاحقاً ونجهّز خطط باقي أفراد العائلة.",
          )}
        </p>
      )}
    </div>
  );
}
