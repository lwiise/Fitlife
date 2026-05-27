"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Languages, Loader2 } from "lucide-react";
import type { MealPlan, LocaleCode } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { getLocaleInfo, getPlanStrings } from "@/lib/plans/locales";
import { PlanViewer } from "../PlanViewer";
import { requestHousekeeperTranslation } from "./actions";

/**
 * Maid view = the SAME /plan UI (PlanViewer), fully localized into the
 * housekeeper's language, wrapped in a minimal kitchen header (Logo + language
 * chip + Arabic-view link + Print). Direction follows the locale.
 *
 * Self-healing: when `needsTranslation`, kick off the translation pass once and
 * poll until the freshly-translated plan_data lands (no manual reload).
 */
export function HousekeeperPlanView({
  plan,
  planId,
  locale,
  needsTranslation = false,
}: {
  plan: MealPlan;
  planId: string;
  locale: LocaleCode;
  needsTranslation?: boolean;
}) {
  const router = useRouter();
  const info = getLocaleInfo(locale);
  const t = getPlanStrings(locale);

  // Fire the translation request exactly once per mount, even across re-renders.
  const requested = useRef(false);
  useEffect(() => {
    if (!needsTranslation || requested.current) return;
    requested.current = true;
    void requestHousekeeperTranslation();
  }, [needsTranslation]);

  // While translations are missing, poll the server component for the updated
  // plan_data; once they land the next render has needsTranslation=false.
  useEffect(() => {
    if (!needsTranslation) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [needsTranslation, router]);

  return (
    <main dir={info.direction} lang={locale} className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10 print:hidden">
        <div className="container-app py-4 flex items-center justify-between gap-3">
          <Logo className="h-9 w-auto" />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-lavender/30 px-3 py-1 text-xs font-bold text-brand-purple-900">
              {info.native_name}
            </span>
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-brand-ink-muted hover:text-brand-ink hover:bg-brand-surface text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <Languages className="size-4" aria-hidden="true" />
              {t.switch_to_arabic}
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <Printer className="size-4" aria-hidden="true" />
              {t.print}
            </button>
          </div>
        </div>
      </header>

      <div className="container-app py-6 md:py-10 space-y-4">
        {needsTranslation && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl bg-brand-lavender/30 border border-brand-purple-900/10 px-4 py-3"
          >
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none text-brand-purple-900 flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-brand-purple-900 text-sm font-bold leading-relaxed">
              {t.translating}
            </p>
          </div>
        )}
        <PlanViewer plan={plan} planId={planId} readOnly locale={locale} />
      </div>
    </main>
  );
}
