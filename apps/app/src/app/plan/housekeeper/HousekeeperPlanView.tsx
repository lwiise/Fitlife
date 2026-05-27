"use client";

import Link from "next/link";
import { Printer, Languages } from "lucide-react";
import type { MealPlan, LocaleCode } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { getLocaleInfo, getPlanStrings } from "@/lib/plans/locales";
import { PlanViewer } from "../PlanViewer";

/**
 * Maid view = the SAME /plan UI (PlanViewer), fully localized into the
 * housekeeper's language, wrapped in a minimal kitchen header (Logo + language
 * chip + Arabic-view link + Print). Direction follows the locale.
 */
export function HousekeeperPlanView({
  plan,
  planId,
  locale,
}: {
  plan: MealPlan;
  planId: string;
  locale: LocaleCode;
}) {
  const info = getLocaleInfo(locale);
  const t = getPlanStrings(locale);

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

      <div className="container-app py-6 md:py-10">
        <PlanViewer plan={plan} planId={planId} readOnly locale={locale} />
      </div>
    </main>
  );
}
