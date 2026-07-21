"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, X } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

const KEY = "fitlife.workoutOptInBanner.dismissed";

/**
 * Once-per-session nudge to add the workout plan, shown to meals-only users
 * after their plan is ready. Mirrors the AddFamilyBanner pattern.
 */
export function WorkoutOptInBanner({ ownerSex }: { ownerSex?: string | null }) {
  const g = genderPick(ownerSex);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only sessionStorage read; runs once ([] deps), no render loop
    if (sessionStorage.getItem(KEY) !== "1") setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(KEY, "1");
    setVisible(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-3 mb-6">
      <Dumbbell className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-brand-ink text-sm font-medium leading-relaxed">
          {g("أكملي منظومتك", "أكمل منظومتك")}: برنامج تمارين أسبوعي مفصّل يوافق هدفك الغذائي، ببضع إجابات قصيرة.
        </p>
        <Link
          href="/onboarding/workout"
          className="inline-flex items-center mt-2 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
        >
          {g("أضيفي خطة التمارين", "أضِف خطة التمارين")}
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء"
        className="flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full hover:bg-brand-purple-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        <X className="size-4 text-brand-ink-muted" aria-hidden="true" />
      </button>
    </div>
  );
}
