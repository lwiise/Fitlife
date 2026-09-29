"use client";

import { useId, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Info } from "lucide-react";
import { arNum } from "@/lib/copy/numbers";
import type { PlanStrings } from "@/lib/plans/locales";

type DayTotals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };

/**
 * The open day's numbers, once, as two lines of plain text under the plan bar
 * (09/2026) — it replaced a totals card that sat between the strip and the
 * meals. Line 1: the date (+ «اليوم»/«أمس»/«غداً») on the start side, the
 * day's calories against the target on the end side, wrapping below the date
 * on a narrow phone. Line 2: the macros.
 *
 * A child is planned by PORTIONS, not a calorie target, so their day reads
 * «نحو …» with no target beside it, and line 2 says «بالحصص حسب العمر» with
 * the explanation one tap away — it used to be a paragraph above every child's
 * plan, whether or not anyone wondered.
 */
export function DayLine({
  date,
  relative,
  total,
  target,
  child,
  strings: t,
  arabic,
}: {
  /** «الثلاثاء ٢٩ سبتمبر», or the locale's own order on the cook's view. */
  date: string;
  relative?: string | null;
  /** The day's totals; null while the day has no meals. */
  total: DayTotals | null;
  /** The member's daily calorie target. */
  target: number;
  /** Set for a child on the Arabic view: the note behind the ⓘ. */
  child?: { note: ReactNode } | null;
  strings: Pick<
    PlanStrings,
    "protein" | "carbs" | "fat" | "grams" | "day_total" | "calories_unit" | "daily_calories"
  >;
  /** The Arabic view: Arabic-Indic digits and the «من» phrasing. The cook's
   * translated view keeps Western digits and the locale's own wording. */
  arabic: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteId = useId();
  const n = (v: number) => (arabic ? arNum(v) : String(Math.round(v)));

  let calories: ReactNode = null;
  if (total) {
    const figure = <b className="text-base font-extrabold text-brand-ink">{n(total.calories)}</b>;
    calories = !arabic ? (
      <>
        {t.day_total} {figure} / {n(target)} {t.calories_unit}
      </>
    ) : child ? (
      <>
        نحو {figure} {t.calories_unit}
      </>
    ) : (
      <>
        {figure} من {n(target)} {t.calories_unit}
      </>
    );
  } else if (!child) {
    // Nothing to total yet: the member's daily figure is the one number left.
    calories = arabic ? (
      <>
        {t.daily_calories} {n(target)} {t.calories_unit}
      </>
    ) : (
      <>
        {t.daily_calories}: {n(target)} {t.calories_unit}
      </>
    );
  }

  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[15px] font-extrabold leading-snug text-brand-ink">
          {date}
          {relative && <span className="text-brand-purple-900"> · {relative}</span>}
        </span>
        {calories && (
          <span className="text-meta tabular-nums text-brand-ink-muted">{calories}</span>
        )}
      </p>

      {child ? (
        <>
          <p className="flex items-center gap-1 text-meta text-brand-ink-muted">
            بالحصص حسب العمر
            {/* 44px target, pulled back to the line's height so the ⓘ does not
                push the meals down. */}
            <button
              type="button"
              onClick={() => setNoteOpen((o) => !o)}
              aria-expanded={noteOpen}
              aria-controls={noteId}
              aria-label="لماذا بالحصص؟"
              className={clsx(
                "-my-3 grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-brand-tint motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand-purple-900",
                noteOpen ? "text-brand-purple-900" : "text-brand-ink-muted",
              )}
            >
              <Info className="size-[18px]" aria-hidden="true" />
            </button>
          </p>
          <p
            id={noteId}
            hidden={!noteOpen}
            className="mt-1 rounded-xl bg-brand-tint px-3 py-2 text-meta leading-relaxed text-brand-ink"
          >
            {child.note}
          </p>
        </>
      ) : (
        total && (
          <p className="text-meta tabular-nums text-brand-ink-muted">
            {t.protein} {n(total.protein_g)} {t.grams} · {t.carbs} {n(total.carbs_g)} {t.grams} ·{" "}
            {t.fat} {n(total.fat_g)} {t.grams}
          </p>
        )
      )}
    </div>
  );
}
