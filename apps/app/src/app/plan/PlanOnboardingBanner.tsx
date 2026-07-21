"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, Users, X } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

const MOM_FIRST_KEY = "plan_banner_mom_first_dismissed";
const DASHBOARD_KEY = "fitlife.addFamilyBanner.dismissed";

/**
 * Post-onboarding banners on /plan, driven by the ?onboarding query param:
 *  - mom-first: once-per-session nudge to add family (coordinated with the
 *    dashboard nudge via a shared sessionStorage key).
 *  - member-added: transient confirmation; strips its own query param on mount
 *    and auto-dismisses after 5s.
 */
export function PlanOnboardingBanner({
  planReady = false,
  ownerSex,
}: {
  planReady?: boolean;
  ownerSex?: string | null;
}) {
  const params = useSearchParams();
  const mode = params.get("onboarding");
  const memberName = params.get("member");

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (mode === "mom-first") {
      // Only nudge once the plan is truly ready — never over the generating loader.
      // SSR-safe sessionStorage read on mount; the effect+setState idiom here
      // avoids a hydration mismatch, so the rule is a false positive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(planReady && sessionStorage.getItem(MOM_FIRST_KEY) !== "1");
      return;
    }
    if (mode === "member-added") {
      setVisible(true);
      // Drop the query so a refresh doesn't replay the banner.
      const url = new URL(window.location.href);
      url.searchParams.delete("onboarding");
      url.searchParams.delete("member");
      window.history.replaceState(null, "", url.toString());
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [mode, planReady]);

  if (!visible) return null;

  if (mode === "member-added") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/15 px-4 py-3 mb-6">
        <Sparkles className="size-5 flex-shrink-0 mt-0.5 text-brand-ink" aria-hidden="true" />
        <p className="flex-1 text-brand-ink text-sm font-medium leading-relaxed">
          تم تحديث خطط العائلة بعد إضافة {memberName ?? "الفرد الجديد"}
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="إخفاء"
          className="flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full hover:bg-brand-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <X className="size-4 text-brand-ink-muted" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // mom-first
  const dismiss = () => {
    sessionStorage.setItem(MOM_FIRST_KEY, "1");
    // Silence the same nudge on the dashboard too.
    sessionStorage.setItem(DASHBOARD_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-3 mb-6">
      <Users className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-brand-ink text-sm font-medium leading-relaxed">
          {genderPick(ownerSex)(
            "خطتك الشخصية جاهزة. شوفيها قبل ما تضيفي بقية العائلة",
            "خطتك الشخصية جاهزة. شوفها قبل ما تضيف بقية العائلة",
          )}
        </p>
        <Link
          href="/family"
          className="inline-flex items-center mt-2 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
        >
          إضافة فرد
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
