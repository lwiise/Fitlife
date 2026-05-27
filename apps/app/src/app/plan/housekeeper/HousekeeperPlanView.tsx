"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Languages } from "lucide-react";
import type { MealPlan, LocaleCode } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { getDayNameInLocale, dayIndexFromWeekStart } from "@/lib/plans/dayMapping";
import { getLocaleInfo, HOUSEKEEPER_STRINGS } from "@/lib/plans/locales";
import { RegenerateButton } from "../RegenerateButton";
import { HousekeeperMealCard } from "./HousekeeperMealCard";

function weekRange(weekStartISO: string | null, locale: LocaleCode): string {
  if (!weekStartISO) return "";
  try {
    const start = new Date(`${weekStartISO}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmt = new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return `${fmt.format(start)} — ${fmt.format(end)}`;
  } catch {
    return weekStartISO;
  }
}

export function HousekeeperPlanView({
  plan,
  weekStartDate,
  locale,
}: {
  plan: MealPlan;
  weekStartDate: string | null;
  locale: LocaleCode;
}) {
  const info = getLocaleInfo(locale);
  const t = HOUSEKEEPER_STRINGS[locale];

  const [dayIndex, setDayIndex] = useState<number | null>(null);
  useEffect(() => {
    const raw = weekStartDate ? dayIndexFromWeekStart(weekStartDate) : 0;
    setDayIndex(raw >= 0 && raw <= 6 ? raw : 0);
  }, [weekStartDate]);

  // Whole plan lacks translations → it predates this feature. Prompt a regen.
  const hasAnyTranslation = useMemo(
    () =>
      plan.members.some((m) =>
        m.days.some((d) =>
          d.meals.some(
            (meal) => meal.prep_steps_translated && meal.prep_steps_translated.length > 0,
          ),
        ),
      ),
    [plan.members],
  );

  const idx = dayIndex ?? 0;
  const sections = plan.members
    .map((m) => ({ member: m, day: m.days.find((d) => d.day_index === idx) }))
    .filter((s) => s.day && s.day.meals.length > 0);

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

      <div className="container-app py-6 md:py-10 max-w-2xl space-y-5">
        <div>
          <p className="text-brand-ink-muted text-xs">{t.this_week}</p>
          <p className="font-bold text-brand-ink text-base tabular-nums">
            {weekRange(weekStartDate, locale)}
          </p>
        </div>

        {!hasAnyTranslation && (
          <div className="rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 p-4 print:hidden">
            <p className="text-brand-ink text-sm leading-relaxed">{t.fallback_note}</p>
            <div className="mt-3">
              <RegenerateButton />
            </div>
          </div>
        )}

        {/* Day tabs */}
        <div className="grid grid-cols-7 gap-1.5 print:hidden">
          {Array.from({ length: 7 }, (_, i) => {
            const isActive = i === idx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDayIndex(i)}
                aria-pressed={isActive}
                className={`rounded-xl py-2.5 font-bold text-[11px] leading-tight transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                  isActive
                    ? "bg-brand-purple-900 text-white"
                    : "bg-brand-lavender/30 text-brand-purple-900 hover:bg-brand-lavender/50"
                }`}
              >
                {getDayNameInLocale(i, locale)}
              </button>
            );
          })}
        </div>

        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
            <p className="text-brand-ink-muted text-sm">—</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map(({ member, day }) => (
              <section key={member.member_id} className="space-y-3 break-inside-avoid">
                <h2 className="font-bold text-brand-ink text-base border-b border-brand-ink/10 pb-1">
                  {member.member_name_ar} · {day!.meals.length} {t.meals}
                </h2>
                <div className="space-y-3">
                  {day!.meals.map((meal, i) => (
                    <HousekeeperMealCard key={i} meal={meal} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
