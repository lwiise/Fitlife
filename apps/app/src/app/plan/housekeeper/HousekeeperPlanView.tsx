"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import type { MealPlan, LocaleCode } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/button";
import { Notice, type NoticeTone } from "@/components/ui/notice";
import { getLocaleInfo, getPlanStrings } from "@/lib/plans/locales";
import { PlanViewer } from "../PlanViewer";
import { AllergyBackstop, type AllergyEntry } from "./AllergyBackstop";
import { requestHousekeeperTranslation } from "./actions";

/**
 * Maid view = the SAME /plan UI (PlanViewer), fully localized into the
 * housekeeper's language, wrapped in a minimal kitchen header (compact logo +
 * language chip + dashboard link). Direction follows the locale.
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
  photos,
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
  // Profile photo URL per member_id, for the member switcher.
  photos?: Readonly<Record<string, string>>;
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

  // One status line at a time, picked by priority: nothing to cook yet ›
  // translation still landing › cooking from last week › more days coming.
  // Tones follow the redesign's Notice vocabulary so the calm states read calm
  // and the one that changes what she cooks (a superseded week) stands out.
  const status: { tone: NoticeTone; text: string } | null = preparing
    ? // Nothing exists to cook or translate yet. Not a spinner — the wait is on
      // the family's plans being written, which is not her doing and not
      // something she can hurry.
      { tone: "info", text: t.awaiting_family }
    : needsTranslation
      ? { tone: "progress", text: t.translating }
      : superseded
        ? // A new week is being built; the plan below is the current one. Said
          // plainly, because the alternative is her cooking from a week that is
          // about to be replaced without knowing it.
          { tone: "warning", text: t.previous_week }
        : partialWeek
          ? // Usable, but not the whole week yet. Said plainly and once, above a
            // plan she can actually cook from — the old behaviour replaced the
            // plan with this message.
            { tone: "info", text: t.partial_week }
          : null;

  return (
    <main dir={info.direction} lang={locale} className="min-h-screen bg-brand-surface">
      {/* A focus route: AppShell renders it bare, so the kitchen screen keeps
          its own minimal bar — logo, her language, the way back.
          data-kitchen-header tells the plan bar below (globals.css) to stick
          beneath this header rather than at the top of the screen. */}
      <header
        data-kitchen-header=""
        className="sticky top-0 z-30 border-b border-brand-line bg-brand-card/95 backdrop-blur supports-[backdrop-filter]:bg-brand-card/85 print:hidden"
      >
        <div className="container-shell flex h-16 items-center justify-between gap-3">
          <Logo variant="compact" className="h-9 w-auto" priority />
          <div className="flex items-center gap-2">
            <span className="inline-flex min-h-8 items-center rounded-full bg-brand-tint px-3 text-meta font-bold text-brand-purple-900">
              {info.native_name}
            </span>
            <ButtonLink href="/dashboard" variant="quiet" className="gap-1.5">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {t.back_to_dashboard}
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="container-shell space-y-4 py-6 lg:py-10">
        {/* The plan itself carries the page's <h1> (the sr-only heading in
            PlanViewer's plan bar), but the preparing state renders instead of
            it — so that screen had no heading at all. Only when the viewer is
            NOT rendered: while a translation is landing the plan still shows,
            and a second <h1> here gave the page two. Visually hidden because
            the design deliberately leads with the status card;
            `preparing_title` already exists in all seven locales. */}
        {(preparing || !plan) && (
          <h1 className="sr-only">{t.preparing_title}</h1>
        )}
        <AllergyBackstop entries={allergyEntries} locale={locale} />
        {status && (
          <Notice tone={status.tone}>
            <p className="font-bold">{status.text}</p>
          </Notice>
        )}
        {!preparing && plan && (
          <PlanViewer
            plan={plan}
            planId={planId}
            readOnly
            locale={locale}
            absences={absences}
            photos={photos}
          />
        )}
      </div>
    </main>
  );
}
