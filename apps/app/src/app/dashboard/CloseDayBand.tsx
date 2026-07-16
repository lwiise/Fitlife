"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, X } from "lucide-react";

import { closeDay } from "@/lib/engagement/actions";
import type {
  CheckinReason,
  CheckinSlot,
  CheckinStatus,
  Verdict,
} from "@/lib/engagement/types";
import {
  dayIndexFromWeekStart,
  dayNameFromWeekStart,
} from "@/lib/plans/dayMapping";

/**
 * ختام اليوم — the 15-second household check-in (approved design direction:
 * gold-for-hospitality, retroactive-first, three chips per slot, family
 * verdict faces).
 *
 * Retroactive-first: the mom's natural visit is MORNING, so the band offers
 * yesterday before today. All "which day is it" math is client-side against
 * Riyadh time, per the repo's day-mapping convention. Unanswered slots are
 * never submitted — unknown stays unknown.
 */

export interface CloseDaySlot {
  slot: CheckinSlot;
  slot_name_ar: string;
  recipe_name_ar: string;
}

export interface CloseDayDay {
  day_index: number;
  slots: CloseDaySlot[];
}

export interface CloseDayMember {
  /** "mom" or family_members.id */
  id: string;
  name: string;
}

const STATUS_CHIPS: Array<{ value: CheckinStatus; label: string }> = [
  { value: "cooked", label: "طبختها كما هي" },
  { value: "swapped", label: "بدّلتها" },
  { value: "skipped", label: "تجاوزتها" },
];

const REASON_CHIPS: Array<{ value: CheckinReason; label: string; gold?: boolean }> = [
  { value: "guests", label: "جاءنا ضيوف", gold: true },
  { value: "ordered_in", label: "طلبنا اليوم" },
  { value: "ate_out", label: "خارج البيت" },
  { value: "missing_ingredients", label: "لم تتوفر المقادير" },
  { value: "no_time", label: "ضاق الوقت" },
];

const VERDICT_CYCLE: Array<Verdict | null> = [null, "loved", "fine", "not_again"];
const VERDICT_FACE: Record<Verdict, string> = {
  loved: "😍",
  fine: "🙂",
  not_again: "😐",
};
const VERDICT_LABEL: Record<Verdict, string> = {
  loved: "أحبه",
  fine: "عادي",
  not_again: "لا يُعاد",
};

interface SlotAnswer {
  status: CheckinStatus | null;
  reason: CheckinReason | null;
  verdicts: Record<string, Verdict | null>;
}

export function CloseDayBand({
  planId,
  weekStart,
  days,
  members,
  closedDayIndexes,
}: {
  planId: string;
  weekStart: string;
  days: CloseDayDay[];
  members: CloseDayMember[];
  closedDayIndexes: number[];
}) {
  const router = useRouter();
  // Day resolution happens after mount (client Riyadh clock), matching
  // TodaysMealsClient — SSR renders nothing to avoid a hydration flash.
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, SlotAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape, scroll lock, focus-into-dialog + Tab trap + focus restore
  // (WCAG 2.4.3 / APG modal contract; extends the ConfirmDialog pattern).
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
      if (e.key === "Tab" && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus();
    };
  }, [open, pending]);

  useEffect(() => {
    const todayIdx = dayIndexFromWeekStart(weekStart);
    const closed = new Set(closedDayIndexes);
    const candidates = [todayIdx - 1, todayIdx].filter(
      (i) =>
        i >= 0 &&
        i <= 6 &&
        !closed.has(i) &&
        days.some((d) => d.day_index === i && d.slots.length > 0),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only client-clock resolution (Riyadh "today" must not be computed during SSR; same pattern as TodaysMealsClient/ConfirmDialog)
    setTargetDayIndex(candidates.length > 0 ? candidates[0]! : null);
  }, [weekStart, closedDayIndexes, days]);

  if (targetDayIndex === null) return null;

  const day = days.find((d) => d.day_index === targetDayIndex);
  if (!day) return null;

  const isYesterday = targetDayIndex < dayIndexFromWeekStart(weekStart);
  const dayName = dayNameFromWeekStart(weekStart, targetDayIndex);

  function setStatus(slot: CheckinSlot, status: CheckinStatus) {
    setAnswers((prev) => {
      const cur = prev[slot] ?? { status: null, reason: null, verdicts: {} };
      const next: SlotAnswer = {
        ...cur,
        status: cur.status === status ? null : status,
      };
      if (next.status === "cooked") next.reason = null;
      if (next.status !== "cooked") next.verdicts = {};
      return { ...prev, [slot]: next };
    });
  }

  function setReason(slot: CheckinSlot, reason: CheckinReason) {
    setAnswers((prev) => {
      const cur = prev[slot] ?? { status: null, reason: null, verdicts: {} };
      return {
        ...prev,
        [slot]: { ...cur, reason: cur.reason === reason ? null : reason },
      };
    });
  }

  function cycleVerdict(slot: CheckinSlot, memberId: string) {
    setAnswers((prev) => {
      const cur = prev[slot] ?? { status: null, reason: null, verdicts: {} };
      const idx = VERDICT_CYCLE.indexOf(cur.verdicts[memberId] ?? null);
      const next = VERDICT_CYCLE[(idx + 1) % VERDICT_CYCLE.length] ?? null;
      return {
        ...prev,
        [slot]: { ...cur, verdicts: { ...cur.verdicts, [memberId]: next } },
      };
    });
  }

  const answeredSlots = day.slots.filter((s) => answers[s.slot]?.status);

  function submit() {
    if (answeredSlots.length === 0 || targetDayIndex === null) return;
    setError(null);
    startTransition(async () => {
      const result = await closeDay({
        meal_plan_id: planId,
        day_index: targetDayIndex,
        slots: answeredSlots.map((s) => ({
          slot: s.slot,
          status: answers[s.slot]!.status!,
          reason:
            answers[s.slot]!.status === "cooked"
              ? null
              : answers[s.slot]!.reason,
        })),
        verdicts: day!.slots.flatMap((s) => {
          const a = answers[s.slot];
          if (a?.status !== "cooked") return [];
          return Object.entries(a.verdicts)
            .filter((e): e is [string, Verdict] => e[1] !== null)
            .map(([member_id, verdict]) => ({
              member_id,
              slot: s.slot,
              recipe_name_ar: s.recipe_name_ar,
              verdict,
            }));
        }),
        exceptions: [],
      });
      if (result.ok) {
        setOpen(false);
        setAnswers({});
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {/* The band — gold, warm, never a red overdue state */}
      <div className="rounded-2xl border-2 border-brand-yellow/40 bg-brand-yellow/15 px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <Moon className="size-5 text-brand-ink flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-40 text-sm font-medium text-brand-ink leading-relaxed">
          {isYesterday
            ? `${dayName} لم يُغلق بعد — كيف كان يومكم؟`
            : "كيف كان يومكم إلى الآن؟"}
        </p>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen(true)}
          className="flex-shrink-0 inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          {isYesterday ? "أغلقي يوم أمس" : "أغلقي يومك"}
        </button>
      </div>

      {/* The sheet */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`ختام يوم ${dayName}`}>
          <div
            className="absolute inset-0 bg-brand-ink/50"
            onClick={() => !pending && setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-brand-surface p-4 pb-6 shadow-2xl"
          >
            <div className="mx-auto max-w-lg space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-brand-ink">
                  ختام يوم {dayName}
                </h2>
                <button
                  type="button"
                  ref={closeBtnRef}
                  onClick={() => !pending && setOpen(false)}
                  aria-label="إغلاق"
                  className="size-11 inline-flex items-center justify-center rounded-full text-brand-ink-muted hover:bg-brand-lavender/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-brand-ink-muted leading-relaxed">
                كل إجابة صادقة تُحسّن خطتكم القادمة — وما لم تجيبي عنه يبقى بلا حكم.
              </p>

              {day.slots.map((s) => {
                const a = answers[s.slot];
                return (
                  <section
                    key={s.slot}
                    aria-label={s.slot_name_ar}
                    className="bg-white rounded-2xl border border-brand-ink/5 p-3.5 space-y-2.5"
                  >
                    <p className="text-sm font-bold text-brand-ink">
                      {s.slot_name_ar} — {s.recipe_name_ar}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_CHIPS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setStatus(s.slot, c.value)}
                          aria-pressed={a?.status === c.value}
                          className={`min-h-11 px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                            a?.status === c.value
                              ? "bg-brand-purple-900 text-white"
                              : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {(a?.status === "swapped" || a?.status === "skipped") && (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="السبب">
                        {REASON_CHIPS.map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => setReason(s.slot, r.value)}
                            aria-pressed={a?.reason === r.value}
                            className={`min-h-11 px-3 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                              a?.reason === r.value
                                ? r.gold
                                  ? "bg-brand-yellow text-brand-ink"
                                  : "bg-brand-purple-900 text-white"
                                : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {a?.status === "cooked" && members.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-brand-ink-muted">
                          من أحبها؟ (اختياري — اضغطي الاسم لتبديل الرأي)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {members.map((m) => {
                            const v = a.verdicts[m.id] ?? null;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => cycleVerdict(s.slot, m.id)}
                                aria-label={`${m.name}: ${v ? VERDICT_LABEL[v] : "بلا رأي"}`}
                                className={`min-h-11 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                                  v
                                    ? "bg-brand-lavender/40 text-brand-purple-900 border border-brand-purple-900/20"
                                    : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                                }`}
                              >
                                <span>{m.name}</span>
                                {v && (
                                  <span aria-hidden="true">
                                    {VERDICT_FACE[v]} {VERDICT_LABEL[v]}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}

              {error && (
                <p role="alert" className="text-sm font-bold text-red-700">
                  {error}
                </p>
              )}

              {answeredSlots.length === 0 && (
                <p className="text-xs text-brand-ink-muted text-center leading-relaxed">
                  اختاري إجابة واحدة على الأقل لإغلاق اليوم
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={pending || answeredSlots.length === 0}
                className="w-full min-h-12 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
              >
                {pending ? "يُحفظ…" : "إغلاق اليوم"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
