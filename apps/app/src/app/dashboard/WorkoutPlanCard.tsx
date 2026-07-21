import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

interface WorkoutPlanCardProps {
  state: "optin" | "generating" | "ready" | "failed";
  /** Meals-first: a live meal generation holds the workout run, so the
   * generating state names the real wait instead of a generic timer. */
  waitingForMeals?: boolean;
  /** Account owner's sex → owner-directed CTA copy (أكملي/اعرضي …). */
  ownerSex?: string | null;
}

const viewLinkClass =
  "inline-flex items-center mt-3 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md";

/**
 * Quick-glance card for the exercise plan. Persistent counterpart to the
 * dismissible WorkoutOptInBanner: meals-only users always have a visible path
 * to add the workout plan, and once one exists the card tracks its lifecycle.
 */
export function WorkoutPlanCard({
  state,
  waitingForMeals = false,
  ownerSex,
}: WorkoutPlanCardProps) {
  const g = genderPick(ownerSex);
  return (
    // flex-col + mt-auto on the CTA: the quick-glance grid stretches cards to
    // equal height, so bottom-pinning keeps this button on the same baseline
    // as the subscription card's regardless of how much text each card holds.
    <div className="bg-white rounded-2xl p-4 border border-brand-ink/5 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="size-10 rounded-full bg-brand-purple-900/10 flex items-center justify-center">
          <Dumbbell className="size-5 text-brand-purple-900" aria-hidden="true" />
        </div>
        <p className="text-brand-ink-muted text-sm font-medium">خطة التمارين</p>
      </div>

      {state === "optin" && (
        <>
          <p className="font-extrabold text-xl text-brand-ink mt-1">
            {g("أكملي منظومتك", "أكمل منظومتك")}
          </p>
          <p className="text-brand-ink-muted text-xs mt-1">
            برنامج تمارين أسبوعي يوافق هدفك الغذائي
          </p>
          <div className="mt-auto pt-3">
            <Link
              href="/onboarding/workout"
              className="inline-flex items-center gap-2 bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-sm px-4 py-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white min-h-[2.75rem]"
            >
              <Dumbbell className="size-4" aria-hidden="true" />
              {g("أضيفي خطة التمارين", "أضِف خطة التمارين")}
            </Link>
          </div>
        </>
      )}

      {state === "generating" && (
        <>
          <p className="font-extrabold text-2xl text-brand-ink mt-1 leading-tight">
            جاري إنشاء برنامجك
          </p>
          <p className="text-brand-ink-muted text-xs mt-1">
            {waitingForMeals ? "نجهّز وجباتك أولاً" : "قد تأخذ دقيقة"}
          </p>
          <a href="/plan?view=workout" className={viewLinkClass}>
            متابعة الحالة
          </a>
        </>
      )}

      {state === "ready" && (
        <>
          <p className="font-extrabold text-xl text-brand-ink mt-1">نشطة</p>
          <p className="text-brand-ink-muted text-xs mt-1">
            برنامجك الأسبوعي جاهز
          </p>
          <a href="/plan?view=workout" className={viewLinkClass}>
            {g("اعرضي التمارين", "اعرض التمارين")}
          </a>
        </>
      )}

      {state === "failed" && (
        <>
          <p className="font-extrabold text-2xl text-brand-ink mt-1 leading-tight">
            آخر محاولة فشلت
          </p>
          <a href="/plan?view=workout" className={viewLinkClass}>
            إعادة المحاولة
          </a>
        </>
      )}
    </div>
  );
}
