"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, LayoutDashboard, Loader2 } from "lucide-react";
import type { MealPlan, LocaleCode } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { getLocaleInfo, getPlanStrings } from "@/lib/plans/locales";
import { PlanViewer } from "../PlanViewer";
import { AllergyBackstop, type AllergyEntry } from "./AllergyBackstop";
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
  preparing = false,
  allergyEntries = [],
}: {
  plan: MealPlan | null;
  planId: string;
  locale: LocaleCode;
  needsTranslation?: boolean;
  // The family plan exists but isn't ready/translated yet (e.g. a member's
  // generation is still in flight). Show a localized waiting state on HER page
  // instead of bouncing to the Arabic /plan view — the poll resolves it.
  preparing?: boolean;
  allergyEntries?: AllergyEntry[];
}) {
  const router = useRouter();
  const info = getLocaleInfo(locale);
  const t = getPlanStrings(locale);

  // Kick off translation while it's still needed and keep nudging it on a
  // throttled cadence until the freshly-translated plan_data lands. A single day
  // can fail (non-fatal in the engine) or the background function can be cut off
  // before the last day — leaving that day untranslated and the banner spinning
  // forever with no recovery. translateMealPlan is idempotent (skips already-done
  // meals) and triggerPlanTranslation skips while a pass is actively writing, so
  // each re-trigger cheaply fills only the missing day(s). Bounded so a
  // deterministically-failing day can't spawn background functions forever.
  const attemptsRef = useRef(0);
  useEffect(() => {
    if (!needsTranslation) {
      attemptsRef.current = 0; // reset for any future gap (e.g. plan re-edited)
      return;
    }
    const MAX_ATTEMPTS = 5;
    const fire = () => {
      if (attemptsRef.current >= MAX_ATTEMPTS) return;
      attemptsRef.current += 1;
      void requestHousekeeperTranslation();
    };
    fire();
    const id = setInterval(fire, 30_000);
    return () => clearInterval(id);
  }, [needsTranslation]);

  // While the plan is preparing OR translations are missing, poll the server
  // component for updated plan_data; once everything lands the next render has
  // preparing=false and needsTranslation=false and the poll stops.
  useEffect(() => {
    if (!preparing && !needsTranslation) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [preparing, needsTranslation, router]);

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
              href="/dashboard"
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {t.back_to_dashboard}
            </Link>
          </div>
        </div>
      </header>

      <div className="container-app py-6 md:py-10 space-y-4">
        <AllergyBackstop entries={allergyEntries} locale={locale} />
        {preparing ? (
          // Family plans still generating (incl. members queued) — translation is
          // gated until they finish, so DON'T imply it's loading. Just inform her
          // it'll start once the plans are ready; the poll flips this when done.
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl bg-brand-lavender/30 border border-brand-purple-900/10 px-4 py-3"
          >
            <Clock className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
            <p className="text-brand-purple-900 text-sm font-bold leading-relaxed">
              {t.awaiting_family}
            </p>
          </div>
        ) : needsTranslation ? (
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
        ) : null}
        {!preparing && plan && (
          <PlanViewer plan={plan} planId={planId} readOnly locale={locale} />
        )}
      </div>
    </main>
  );
}
