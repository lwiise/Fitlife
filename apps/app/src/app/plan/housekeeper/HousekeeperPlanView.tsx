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
  partialWeek = false,
  superseded = false,
  absences = [],
  allergyEntries = [],
}: {
  plan: MealPlan | null;
  planId: string;
  locale: LocaleCode;
  needsTranslation?: boolean;
  // NOTHING is cookable yet — no plan content at all. Show a localized waiting
  // state on HER page instead of bouncing to the Arabic /plan view; the poll
  // resolves it.
  preparing?: boolean;
  // Some of the household is still being generated. She sees the plan either
  // way — this only adds a line saying more is coming, so a half-filled week
  // does not read as the finished article.
  partialWeek?: boolean;
  // The plan below is the PREVIOUS week, served because a regeneration is in
  // flight and its row has no meals yet. Serving it silently would have her
  // cooking from a superseded week with no way to tell.
  superseded?: boolean;
  // Shared-meal absences (00021). She cannot toggle them — PlanViewer gates the
  // control on `!readOnly` — but she MUST see the adjusted batch, because she is
  // the one measuring it out.
  absences?: Array<{ day_index: number; slot: string; member_id: string }>;
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

  // While anything is still landing — no content yet, missing translations, or
  // the rest of the household still generating — poll the server component for
  // updated plan_data. Once it is all in, the next render clears all three and
  // the poll stops. partialWeek is in the list because her page can now be fully
  // usable while days are still arriving, and those days should appear on their
  // own rather than on a manual reload.
  useEffect(() => {
    if (!preparing && !needsTranslation && !partialWeek && !superseded) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [preparing, needsTranslation, partialWeek, superseded, router]);

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
        {/* The plan itself carries the page's <h1> (PlanViewer's week range),
            but the preparing/translating states render instead of it — so
            those screens had no heading at all. Visually hidden because the
            design deliberately leads with the status card; `preparing_title`
            already exists in all seven locales, so this needs no new copy. */}
        {(preparing || needsTranslation || !plan) && (
          <h1 className="sr-only">{t.preparing_title}</h1>
        )}
        <AllergyBackstop entries={allergyEntries} locale={locale} />
        {preparing ? (
          // Nothing exists to cook or translate yet. Not a spinner — the wait is
          // on the family's plans being written, which is not her doing and not
          // something she can hurry.
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
        ) : superseded ? (
          // A new week is being built; the plan below is the current one. Said
          // plainly, because the alternative is her cooking from a week that is
          // about to be replaced without knowing it.
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl bg-brand-lavender/30 border border-brand-purple-900/10 px-4 py-3"
          >
            <Clock className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
            <p className="text-brand-purple-900 text-sm font-bold leading-relaxed">
              {t.previous_week}
            </p>
          </div>
        ) : partialWeek ? (
          // Usable, but not the whole week yet. Said plainly and once, above a
          // plan she can actually cook from — the old behaviour replaced the
          // plan with this message.
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl bg-brand-lavender/30 border border-brand-purple-900/10 px-4 py-3"
          >
            <Clock className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
            <p className="text-brand-purple-900 text-sm font-bold leading-relaxed">
              {t.partial_week}
            </p>
          </div>
        ) : null}
        {!preparing && plan && (
          <PlanViewer
            plan={plan}
            planId={planId}
            readOnly
            locale={locale}
            absences={absences}
          />
        )}
      </div>
    </main>
  );
}
