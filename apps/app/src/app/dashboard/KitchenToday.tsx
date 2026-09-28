"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { BookOpen, Check, ChefHat, Clock, Loader2, Minus, Repeat2 } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { countAr, DISH_FORMS, MEAL_FORMS, MINUTE_FORMS } from "@/lib/copy/plural";
import { setMealCheckin, setSharedMealCheckin } from "@/lib/engagement/actions";
import type { CheckinStatus } from "@/lib/engagement/types";
import { OWNER_ID, type TodayRow } from "@/lib/dashboard/todayTable";
import { MAIN_SLOTS, partOfDay, pickTicket } from "@/lib/dashboard/ticket";

export interface KitchenPerson {
  id: string;
  name: string;
  rosterIndex: number;
}

export interface KitchenCook {
  name: string;
  sex: string | null;
  /** «بالتاغالوغية» — the language she reads, in Arabic. */
  languageAr: string;
  /** Her language code, for the translated dish's lang attribute. */
  locale: string;
  dir: "rtl" | "ltr";
}

const STATUS_TAG: Record<CheckinStatus, string> = {
  cooked: "كما هي",
  swapped: "بُدّلت",
  skipped: "لم تُطبخ",
};

/** «لـفهد», folding the article: «الجدة» → «للجدة». */
function forName(name: string) {
  const n = name.trim();
  return n.startsWith("ال") ? `ل${n.slice(1)}` : `ل${n}`;
}

/** A thin vertical rule between facts. A «·» beside Arabic-Indic digits reads
 * as a zero («دقيقة · ٥»), so facts are never separated by middle dots. */
function Sep({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "mx-2 inline-block h-3.5 w-px align-middle",
        tone === "light" ? "bg-white/35" : "bg-brand-ink/20",
      )}
    />
  );
}

/**
 * «تذكرة المطبخ» (09/2026, the owner's chosen home). One object leads the
 * screen: an order ticket for the current main meal — the dish, who it feeds,
 * each person's share of the pot — with the cook's copy torn off below it.
 * The rest of today follows as a run-sheet where EVERY meal is one tap to mark
 * (the part of day only chooses which meal is on the ticket; it never blocks a
 * mark, so home and /plan follow one rule). Marks go through the same server
 * actions /plan uses, with the same roster (present sharers).
 */
export function KitchenToday({
  planId,
  dayIndex,
  rows,
  people,
  ownerSex,
  householdSize,
  hour,
  cook,
  ownerDay,
}: {
  planId: string;
  dayIndex: number;
  rows: TodayRow[];
  people: KitchenPerson[];
  ownerSex: string | null;
  householdSize: number;
  /** Riyadh hour, from the server (no clock reads in render). */
  hour: number;
  cook: KitchenCook | null;
  ownerDay: { calories: number; target: number } | null;
}) {
  const g = genderPick(ownerSex);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Map<string, CheckinStatus | null>>(() => new Map());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The ticket that was just marked keeps its place for a moment as a
  // confirmation with undo, so a quick second tap can never land on the next
  // dish, then the ticket moves forward.
  const [justMarked, setJustMarked] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [toast, setToast] = useState<{ text: string; action: string; run: () => void } | null>(
    null,
  );
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const byId = new Map(people.map((p) => [p.id, p]));
  const statusOf = (r: TodayRow) => (overrides.has(r.key) ? overrides.get(r.key)! : r.status);
  const live = rows.map((r) => ({ ...r, status: statusOf(r) }));
  const ticket = justMarked
    ? (live.find((r) => r.key === justMarked) ?? null)
    : pickTicket(live, hour);
  const rest = live.filter((r) => r.key !== ticket?.key);
  const cookedCount = live.filter((r) => r.status === "cooked").length;
  const solo = householdSize <= 1;

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function write(row: TodayRow, status: CheckinStatus | null) {
    const before = statusOf(row);
    setOverrides((m) => new Map(m).set(row.key, status));
    setBusyKey(row.key);
    setError(null);
    const call = row.shared
      ? setSharedMealCheckin({
          meal_plan_id: planId,
          day_index: dayIndex,
          slot: row.slot,
          member_ids: row.writeIds,
          status,
          reason: null,
        })
      : setMealCheckin({
          meal_plan_id: planId,
          day_index: dayIndex,
          slot: row.slot,
          member_id: row.writeIds[0]!,
          status,
          reason: null,
        });
    call
      .then((res) => {
        if (!res.ok) {
          setOverrides((m) => new Map(m).set(row.key, before));
          setError(res.error);
          return;
        }
        // The season board is server-rendered: re-read it.
        startTransition(() => router.refresh());
      })
      .catch(() => {
        setOverrides((m) => new Map(m).set(row.key, before));
        setError(
          g(
            "تعذّر حفظ التسجيل. تحقّقي من الاتصال وحاولي مرة أخرى.",
            "تعذّر حفظ التسجيل. تحقّق من الاتصال وحاول مرة أخرى.",
          ),
        );
      })
      .finally(() => setBusyKey(null));
  }

  function markTicket(row: TodayRow, status: CheckinStatus) {
    write(row, status);
    setShowAlternatives(false);
    setJustMarked(row.key);
    later(() => setJustMarked((k) => (k === row.key ? null : k)), 6000);
  }

  function undoTicket(row: TodayRow) {
    write(row, null);
    setJustMarked(null);
  }

  function toggleRow(row: TodayRow) {
    const before = statusOf(row);
    if (before === null) {
      write(row, "cooked");
      setToast({ text: `سُجّل «${row.recipeName}» كما هو`, action: "تراجع", run: () => write(row, null) });
    } else {
      write(row, null);
      setToast({ text: `أُلغي تسجيل «${row.recipeName}»`, action: "إعادة", run: () => write(row, before) });
    }
    later(() => setToast(null), 6000);
  }

  // «لكِ ولفهد ولمى» / «للبيت كله».
  function forEaters(ids: readonly string[]) {
    if (!solo && ids.length >= householdSize) return "للبيت كله";
    return ids
      .map((id, i) => {
        const part = id === OWNER_ID ? g("لكِ", "لك") : forName(byId.get(id)?.name ?? "");
        return i === 0 ? part : `و${part}`;
      })
      .join(" ");
  }
  const nameOf = (id: string) => (id === OWNER_ID ? g("أنتِ", "أنتَ") : (byId.get(id)?.name ?? ""));

  return (
    <div className="space-y-4">
      {ticket ? (
        <Ticket
          row={ticket}
          index={live.findIndex((r) => r.key === ticket.key)}
          total={live.length}
          nowSlot={partOfDay(hour)}
          confirmed={justMarked === ticket.key}
          busy={busyKey === ticket.key}
          solo={solo}
          ownerSex={ownerSex}
          forEaters={forEaters}
          nameOf={nameOf}
          showAlternatives={showAlternatives}
          onAlternatives={() => setShowAlternatives((v) => !v)}
          onMark={(s) => markTicket(ticket, s)}
          onUndo={() => undoTicket(ticket)}
          cook={cook}
          dishCount={live.length}
        />
      ) : (
        <DayDone
          cooked={cookedCount}
          total={live.length}
          openLeft={live.filter((r) => r.status === null).length}
          ownerSex={ownerSex}
        />
      )}

      {error && (
        <p role="alert" className="text-meta font-bold text-critical">
          {error}
        </p>
      )}

      {rest.length > 0 && (
        <section
          aria-labelledby="rest-title"
          className="rounded-[1.375rem] border border-brand-line bg-brand-card"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
            <h2 id="rest-title" className="text-app-section text-brand-ink">
              {ticket ? "بقية سفرة اليوم" : "سفرة اليوم"}
            </h2>
            <Link
              href="/plan"
              className="-me-2 inline-flex min-h-11 items-center rounded-full px-2 text-[15px] font-bold text-brand-purple-900 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              الأسبوع كاملاً
            </Link>
          </div>
          <ul className="divide-y divide-brand-line">
            {rest.map((row) => {
              const status = row.status;
              const busy = busyKey === row.key;
              return (
                <li key={row.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleRow(row)}
                    disabled={busy}
                    aria-pressed={status !== null}
                    aria-label={
                      status === null
                        ? `طبختها كما هي: ${row.recipeName}`
                        : `إلغاء تسجيل ${row.recipeName}`
                    }
                    className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "grid size-7 place-items-center rounded-full",
                        status === null && "border-2 border-dashed border-brand-ink/30",
                        status === "cooked" && "bg-brand-yellow text-brand-ink",
                        (status === "swapped" || status === "skipped") &&
                          "border-2 border-brand-ink/25 text-brand-ink-muted",
                      )}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : status === "cooked" ? (
                        <Check className="size-4" strokeWidth={3} />
                      ) : status === "swapped" ? (
                        <Repeat2 className="size-3.5" />
                      ) : status === "skipped" ? (
                        <Minus className="size-3.5" />
                      ) : null}
                    </span>
                  </button>
                  <Link
                    href="/plan"
                    className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <span className="block text-meta text-brand-ink-muted">
                      {row.slotLabel}
                      {!solo && (
                        <>
                          <Sep tone="dark" />
                          {forEaters(row.eaterIds)}
                        </>
                      )}
                    </span>
                    <span
                      className={clsx(
                        "mt-0.5 block text-[1.0625rem] font-bold leading-snug",
                        status === null ? "text-brand-ink" : "text-brand-ink/70",
                      )}
                    >
                      {row.recipeName}
                    </span>
                  </Link>
                  {status && (
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2.5 py-1 text-meta font-bold",
                        status === "cooked"
                          ? "border border-gold-line bg-gold-soft text-brand-ink"
                          : "bg-brand-ink/[0.06] text-brand-ink-muted",
                      )}
                    >
                      {STATUS_TAG[status]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap items-center gap-y-1 border-t border-brand-line px-4 py-3 text-meta text-brand-ink-muted sm:px-5">
            <span>
              طُبخ اليوم <b className="text-brand-ink">{arNum(cookedCount)}</b> من{" "}
              <b className="text-brand-ink">{arNum(live.length)}</b> كما هي
            </span>
            {ownerDay && (
              <>
                <Sep tone="dark" />
                <span>
                  {g("مجموع يومكِ", "مجموع يومك")}{" "}
                  <b className="text-brand-ink">{arNum(ownerDay.calories)}</b> من{" "}
                  <b className="text-brand-ink">{arNum(ownerDay.target)}</b> سعرة
                </span>
              </>
            )}
          </p>
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl bg-brand-ink px-4 py-2 text-[15px] text-white"
        >
          <span className="min-w-0 truncate">{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              toast.run();
              setToast(null);
            }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 font-bold text-brand-lavender hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {toast.action}
          </button>
        </div>
      )}
    </div>
  );
}

function Ticket({
  row,
  index,
  total,
  nowSlot,
  confirmed,
  busy,
  solo,
  ownerSex,
  forEaters,
  nameOf,
  showAlternatives,
  onAlternatives,
  onMark,
  onUndo,
  cook,
  dishCount,
}: {
  row: TodayRow & { status: CheckinStatus | null };
  index: number;
  total: number;
  nowSlot: (typeof MAIN_SLOTS)[number];
  confirmed: boolean;
  busy: boolean;
  solo: boolean;
  ownerSex: string | null;
  forEaters: (ids: readonly string[]) => string;
  nameOf: (id: string) => string;
  showAlternatives: boolean;
  onAlternatives: () => void;
  onMark: (s: CheckinStatus) => void;
  onUndo: () => void;
  cook: KitchenCook | null;
  dishCount: number;
}) {
  const g = genderPick(ownerSex);
  const isNow = row.slot === nowSlot;
  const ownerEats = row.eaterIds.includes(OWNER_ID);
  const potFor = forEaters(row.eaterIds);
  const whoLine = solo
    ? null
    : row.shared && row.eaterIds.length > 1
      ? `قدر واحد ${potFor}`
      : row.eaterIds.length === 1 && row.eaterIds[0] === OWNER_ID
        ? g("طبقكِ", "طبقك")
        : `طبق ${row.eaterIds.map(nameOf).join(" و")}`;
  const kcalLine =
    row.kcal == null
      ? null
      : ownerEats
        ? `${g("حصتكِ", "حصتك")} ${arNum(row.kcal)} سعرة`
        : `${arNum(row.kcal)} سعرة ${row.kcalFor ? forEaters([row.kcalFor]) : ""}`;
  const cookTranslated = !cook
    ? null
    : cook.locale === "ar"
      ? row.recipeName
      : row.translatedName && row.translatedLocale === cook.locale
        ? row.translatedName
        : null;
  const cookPronoun = cook?.sex === "male" ? "له" : "لها";

  return (
    <article
      aria-labelledby="ticket-dish"
      className="overflow-hidden rounded-[1.75rem] bg-brand-purple-900 text-white shadow-[0_18px_40px_-24px_rgba(78,36,144,0.8)]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px]">
            <b className="font-extrabold">{row.slotLabel}</b>
            <Sep />
            <span className="text-white/75">{isNow ? "الآن في المطبخ" : "التالي في المطبخ"}</span>
          </p>
          <span className="shrink-0 rounded-lg border border-white/30 px-2 py-0.5 text-meta text-white/85">
            الطبق {arNum(index + 1)} من {arNum(total)}
          </span>
        </div>

        <h2
          id="ticket-dish"
          className="mt-3 line-clamp-2 text-[1.875rem] font-extrabold leading-[1.2] lg:text-[2.625rem]"
        >
          {row.recipeName}
        </h2>

        {(whoLine || kcalLine) && (
          <p className="mt-2 text-[15px] text-white/80">
            {whoLine}
            {whoLine && kcalLine && <Sep />}
            {kcalLine}
          </p>
        )}

        {row.shares.length > 1 && (
          <div className="mt-4">
            <p className="text-meta text-white/70">نصيب كل فرد من القدر</p>
            <PotBar shares={row.shares} />
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta">
              {row.shares.map((s) => (
                <li key={s.id} className={s.id === OWNER_ID ? "font-bold text-white" : "text-white/75"}>
                  {nameOf(s.id)} <span className="tabular-nums">{arNum(s.pct)}٪</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(row.prepMinutes != null || row.cookMinutes != null) && (
          <p className="mt-3 flex items-center text-meta text-white/70">
            <Clock className="me-1.5 size-4" aria-hidden="true" />
            {row.prepMinutes != null && <>تحضير {countAr(row.prepMinutes, MINUTE_FORMS, arNum)}</>}
            {row.prepMinutes != null && row.cookMinutes != null && <Sep />}
            {row.cookMinutes != null && <>طبخ {countAr(row.cookMinutes, MINUTE_FORMS, arNum)}</>}
          </p>
        )}

        {confirmed ? (
          <div
            role="status"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3"
          >
            <p className="flex items-center gap-2 text-[15px] font-bold">
              <span className="grid size-7 place-items-center rounded-full bg-brand-yellow text-brand-ink">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
              </span>
              {row.status === "cooked"
                ? solo
                  ? "سُجّلت كما هي"
                  : `سُجّلت ${potFor} في موسم بيتنا`
                : row.status === "swapped"
                  ? "سُجّلت: بُدّلت"
                  : "سُجّلت: لم تُطبخ"}
            </p>
            <button
              type="button"
              onClick={onUndo}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-full px-3 font-bold text-brand-lavender hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              تراجع
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onMark("cooked")}
                disabled={busy}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-card px-6 text-base font-extrabold text-brand-purple-900 hover:bg-brand-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple-900 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check className="size-5" aria-hidden="true" />
                )}
                طبختها كما هي
              </button>
              <Link
                href="/plan"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-white/35 px-5 text-base font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <BookOpen className="size-5" aria-hidden="true" />
                الوصفة والمقادير
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAlternatives}
                aria-expanded={showAlternatives}
                className="-ms-2 inline-flex min-h-11 items-center rounded-full px-2 text-meta font-bold text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                بدّلتها أو تجاوزتها
              </button>
              {showAlternatives && (
                <>
                  <button
                    type="button"
                    onClick={() => onMark("swapped")}
                    className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-meta font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    بدّلتها
                  </button>
                  <button
                    type="button"
                    onClick={() => onMark("skipped")}
                    className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-meta font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    تجاوزتها
                  </button>
                </>
              )}
            </div>
            {!solo && row.eaterIds.length > 1 && (
              <p className="mt-2 text-meta text-white/70">
                ضغطة واحدة تُحتسب {potFor} في موسم بيتنا.
              </p>
            )}
          </>
        )}
      </div>

      {cook && (
        <div className="ticket-perforation bg-brand-tint px-5 pb-5 pt-5 text-brand-ink sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-card text-brand-purple-900">
              <ChefHat className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <b className="text-[1.0625rem] font-extrabold">نسخة {cook.name} لليوم</b>
                <span className="rounded-full bg-brand-card px-2 py-0.5 text-meta font-bold text-brand-purple-900">
                  {cook.languageAr}
                </span>
              </p>
              {cookTranslated ? (
                <p lang={cook.locale} dir={cook.dir} className="mt-1 text-[15px] text-brand-ink">
                  {cookTranslated}
                </p>
              ) : (
                <p className="mt-1 text-meta text-brand-ink-muted">
                  نجهّز ترجمة أطباق اليوم {forName(cook.name)}.
                </p>
              )}
              <p className="mt-0.5 text-meta text-brand-ink-muted">
                {countAr(dishCount, DISH_FORMS, arNum)} بمقاديرها وخطواتها
              </p>
            </div>
          </div>
          <Link
            href="/plan/housekeeper"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border-[1.5px] border-brand-purple-900/25 bg-brand-card px-5 text-[15px] font-bold text-brand-purple-900 hover:bg-brand-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            {g(`افتحيها ${cookPronoun}`, `افتحها ${cookPronoun}`)}
          </Link>
        </div>
      )}
    </article>
  );
}

/** The pot, split by share. SVG attributes rather than inline styles; drawn
 * from the right so the first eater (the owner) sits at the reading start. */
function PotBar({ shares }: { shares: Array<{ id: string; pct: number }> }) {
  const gap = 1;
  const usable = 100 - gap * (shares.length - 1);
  // Precompute each segment's start, right to left (a pure reduce, no
  // reassignment during render).
  const segs = shares.map((s, i) => {
    const w = (s.pct / 100) * usable;
    const before = shares
      .slice(0, i)
      .reduce((n, p) => n + (p.pct / 100) * usable + gap, 0);
    return { ...s, w, x: 100 - before - w };
  });
  return (
    <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-2 block h-2.5 w-full" aria-hidden="true">
      {segs.map(({ id, w, x }) => {
        const s = { id };
        return (
          <rect
            key={s.id}
            x={x}
            y={0}
            width={w}
            height={6}
            rx={3}
            fill={s.id === OWNER_ID ? "#FCFBFE" : "var(--color-brand-lavender)"}
            fillOpacity={s.id === OWNER_ID ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}

function DayDone({
  cooked,
  total,
  openLeft,
  ownerSex,
}: {
  cooked: number;
  total: number;
  openLeft: number;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  return (
    <section
      aria-labelledby="day-done"
      className="rounded-[1.75rem] bg-brand-purple-900 p-5 text-white sm:p-6"
    >
      <h2 id="day-done" className="text-[1.75rem] font-extrabold leading-tight">
        {openLeft === 0 ? "اكتملت سفرة اليوم" : "سُجّلت وجبات اليوم الرئيسية"}
      </h2>
      <p className="mt-2 text-[15px] text-white/80">
        طُبخ اليوم {arNum(cooked)} من {arNum(total)} كما هي.
        {openLeft > 0 &&
          ` ${openLeft === 2 ? "بقيت وجبتان" : `بقيت ${countAr(openLeft, MEAL_FORMS, arNum)}`} ${g("تسجّلينها", "تسجّلها")} من القائمة أدناه بضغطة على الدائرة.`}
      </p>
    </section>
  );
}
