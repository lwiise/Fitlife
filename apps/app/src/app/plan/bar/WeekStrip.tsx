"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { stripDayLabel, type StripDay, type StripDayState } from "@/lib/plans/weekStrip";

export type WeekStripDay = StripDay & {
  state: StripDayState;
  muted?: boolean;
  /** Spoken after this cell's date in place of its state's label — a day
   * before a member joined the plan says so, not «لم يُجهَّز بعد». */
  stateLabel?: string;
};

/**
 * The plan bar's seven dated days — a tablist, because picking a day swaps the
 * content below it. Colour, not motion, carries the selection: no sliding pill
 * (restrained motion), and a cell never moves when another is chosen.
 */
export function WeekStrip({
  days,
  selected,
  onSelect,
  todayLabel,
  label,
  stateLabels,
  panelId,
}: {
  /** `muted` = a workout rest day, or a day before a member joined the plan. */
  days: WeekStripDay[];
  /** The selected cell's StripDay.index. */
  selected: number;
  onSelect: (index: number) => void;
  /** «اليوم» on Arabic, shown in place of today's weekday. Omitted on
   * translated views, where the ring marks today visually and
   * aria-current="date" says it in the reader's own language. */
  todayLabel?: string;
  /** The tablist's accessible name, «أيام الأسبوع». */
  label: string;
  /** Spoken after a cell's date, e.g. { empty: "لم يُجهَّز بعد", pending: "قيد التحضير" }. */
  stateLabels?: Partial<Record<StripDayState, string>>;
  /** id of the region the tabs control, when the viewer gives it one. */
  panelId?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  if (days.length === 0) return null;
  // Roving tabindex needs exactly one stop, even if `selected` names no cell.
  const tabStop = days.some((d) => d.index === selected) ? selected : days[0]!.index;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, pos: number) {
    // Arrows follow the screen, not the index: in RTL the next day is to the
    // LEFT. Read the rendered direction — the housekeeper's view can be LTR.
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
        next = rtl ? pos + 1 : pos - 1;
        break;
      case "ArrowRight":
        next = rtl ? pos - 1 : pos + 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = days.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = (next + days.length) % days.length;
    onSelect(days[next]!.index);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  const sep = days[0]!.locale === "ar" || days[0]!.locale === "ur" ? "، " : ", ";

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      // Below 352px the padding and gaps shrink to 12px in all, which keeps
      // every cell a 44px target down to a 320px phone.
      className="grid grid-cols-7 gap-1 px-4 pb-2 max-[375px]:gap-0.5 max-[352px]:gap-px max-[352px]:px-[3px]"
    >
      {days.map((day, pos) => {
        const isSelected = day.index === selected;
        const notReady = day.state !== "ready";
        const showToday = day.isToday && !!todayLabel;
        const stateLabel = day.stateLabel ?? stateLabels?.[day.state];
        const name = [
          stripDayLabel(day),
          day.isToday && todayLabel ? todayLabel : null,
          stateLabel ?? null,
        ]
          .filter(Boolean)
          .join(sep);

        return (
          <button
            key={day.index}
            type="button"
            role="tab"
            id={`${baseId}-day-${day.index}`}
            aria-selected={isSelected}
            // Needs no translation — the cook's view has no «اليوم» word.
            aria-current={day.isToday ? "date" : undefined}
            aria-controls={panelId}
            aria-label={name}
            tabIndex={day.index === tabStop ? 0 : -1}
            onClick={() => onSelect(day.index)}
            onKeyDown={(e) => onKeyDown(e, pos)}
            className={clsx(
              "relative flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl py-1 transition-colors motion-reduce:transition-none",
              // An outline, so focus never fights today's inset ring.
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple-900",
              isSelected
                ? "bg-brand-purple-900 text-white"
                : day.muted
                  ? "border border-brand-line bg-brand-card text-brand-ink-muted"
                  : notReady
                    ? "border border-dashed border-brand-ink/25 bg-transparent text-brand-ink-muted"
                    : "bg-brand-tint text-brand-purple-900 hover:bg-brand-lavender/40",
              !isSelected && day.isToday && "ring-2 ring-inset ring-brand-purple-900",
              !isSelected && day.isToday && notReady && !day.muted && "text-brand-purple-900",
            )}
          >
            <span aria-hidden="true" className="max-w-full truncate text-[13px] font-bold leading-tight">
              {showToday ? todayLabel : day.weekdayShort}
            </span>
            {/* A day being prepared shows the spinner in the date's place: a
                corner badge collided with the weekday in a 47px cell. The date
                stays in the accessible name. */}
            {day.state === "pending" ? (
              <span aria-hidden="true" className="grid h-5 place-items-center">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              </span>
            ) : (
              <span aria-hidden="true" className="text-base font-extrabold leading-tight">
                {day.dayOfMonth}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
