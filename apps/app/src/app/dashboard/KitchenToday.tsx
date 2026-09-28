"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ArrowRightLeft,
  BookOpen,
  Check,
  ChefHat,
  ChevronLeft,
  Clock,
  Loader2,
  MessageCircle,
  Minus,
  Printer,
  Repeat2,
  Smartphone,
} from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { arNum, arPct } from "@/lib/copy/numbers";
import { countAr, DISH_FORMS, MINUTE_FORMS } from "@/lib/copy/plural";
import { setMealCheckin, setSharedMealCheckin } from "@/lib/engagement/actions";
import { starsForDay } from "@/lib/engagement/seasonMath";
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

/** The owner's week as the season board counts it, for the confirmation line. */
export interface OwnerWeek {
  mealsMarked: number;
  mealsPlanned: number;
  sessionsMarked?: number;
  sessionsPlanned?: number;
}

const STATUS_TAG: Record<CheckinStatus, string> = {
  cooked: "كما هي",
  swapped: "بدّلتها",
  skipped: "تجاوزتها",
};

const MAIN_AR: Record<(typeof MAIN_SLOTS)[number], string> = {
  breakfast: "الفطور",
  lunch: "الغداء",
  dinner: "العشاء",
};
const WHEN_AR: Record<(typeof MAIN_SLOTS)[number], string> = {
  breakfast: "صباحاً",
  lunch: "ظهراً",
  dinner: "مساءً",
};

/** «لثلاثة» — a pot for N people. */
const FOR_COUNT = ["", "لواحد", "لاثنين", "لثلاثة", "لأربعة", "لخمسة", "لستة", "لسبعة", "لثمانية"];
/** «لأربعتكم» — credited to all N of you. */
const FOR_ALL_OF_YOU = ["", "", "لكليكما", "لثلاثتكم", "لأربعتكم", "لخمستكم", "لستتكم", "لسبعتكم", "لثمانيتكم"];

const forCount = (n: number) => FOR_COUNT[n] ?? `لـ${arNum(n)}`;
const forAllOfYou = (n: number) => FOR_ALL_OF_YOU[n] || "لكم جميعاً";

/** «لفهد», folding the article: «الجدة» → «للجدة». */
function forName(name: string) {
  const n = name.trim();
  return n.startsWith("ال") ? `ل${n.slice(1)}` : `ل${n}`;
}

function Sep() {
  return <i className="sep" aria-hidden="true" />;
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" fill="#F2BB16" />
    </svg>
  );
}

/**
 * «تذكرة المطبخ» (09/2026, the owner's chosen home), built to the approved
 * mockup. One object leads the screen: an order ticket for the main meal of
 * this part of the day — the dish, who it feeds, each person's share of the
 * pot — with the cook's copy torn off below it. While that meal is due the
 * ticket carries «طبختها كما هي»; once answered it moves forward to the next
 * main meal as preparation. The rest of today follows as a run-sheet where
 * EVERY meal is one tap (later meals show a dashed ring, but the part of day
 * never gates a mark — home and /plan follow one rule). Marks go through the
 * same server actions /plan uses, with the same roster (present sharers).
 */
export function KitchenToday({
  planId,
  dayIndex,
  dayName,
  rows,
  people,
  ownerSex,
  householdSize,
  hour,
  cook,
  ownerDay,
  ownerWeek,
  tomorrow,
  workout,
}: {
  planId: string;
  dayIndex: number;
  /** «السبت». */
  dayName: string;
  rows: TodayRow[];
  people: KitchenPerson[];
  ownerSex: string | null;
  householdSize: number;
  /** Riyadh hour, from the server (no clock reads in render). */
  hour: number;
  cook: KitchenCook | null;
  ownerDay: { calories: number; target: number } | null;
  ownerWeek: OwnerWeek | null;
  /** Tomorrow's dishes, when tomorrow is still inside the plan week. */
  tomorrow: { dayName: string; rows: TodayRow[] } | null;
  /** Today's workout row (server-rendered), placed under the run-sheet. */
  workout?: ReactNode;
}) {
  const g = genderPick(ownerSex);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Map<string, CheckinStatus | null>>(() => new Map());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The ticket that was just marked keeps its place for a moment as a
  // confirmation with undo, so a quick second tap can never land on the next
  // dish; then the ticket moves forward.
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
  const nowIdx = MAIN_SLOTS.indexOf(partOfDay(hour));

  // Which part of the day each row belongs to: a main meal is its own; a
  // snack belongs after the main meal before it in the day's order.
  const partOf = new Map<string, number>();
  live.reduce((prevMain, r) => {
    const i = MAIN_SLOTS.indexOf(r.slot as (typeof MAIN_SLOTS)[number]);
    partOf.set(r.key, i >= 0 ? i : prevMain);
    return i >= 0 ? i : prevMain;
  }, -1);
  const isLater = (r: TodayRow) => {
    const p = partOf.get(r.key) ?? -1;
    return r.slot === "snack" ? p >= nowIdx : p > nowIdx;
  };
  const whenLabel = (r: TodayRow) => {
    const p = partOf.get(r.key) ?? -1;
    if (r.slot !== "snack") return WHEN_AR[MAIN_SLOTS[p]!];
    return p >= 0 ? `بعد ${MAIN_AR[MAIN_SLOTS[p]!]}` : "صباحاً";
  };

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

  const wholeHouse = (r: TodayRow) =>
    !solo && r.absentIds.length === 0 && r.eaterIds.length >= householdSize;
  const nameOf = (id: string) => byId.get(id)?.name ?? "";
  const namesOf = (ids: readonly string[]) => ids.map(nameOf).filter(Boolean).join(" و");

  // The confirmation line: «+١ وجبة لأربعتكم، ونسبتكِ الآن ٦٦٪».
  function confirmation(row: TodayRow & { status: CheckinStatus | null }) {
    if (row.status === "swapped") return "سُجّلت: بدّلتها";
    if (row.status === "skipped") return "سُجّلت: تجاوزتها";
    const who = solo || row.eaterIds.length < 2 ? "" : ` ${forAllOfYou(row.eaterIds.length)}`;
    let line = `+١ وجبة${who}`;
    const ownerEats = row.eaterIds.includes(OWNER_ID);
    if (ownerWeek && ownerEats && ownerWeek.mealsPlanned > 0) {
      // The server's figure already counts a mark it has seen.
      const serverHad = rows.find((r) => r.key === row.key)?.status === "cooked";
      const m = Math.min(ownerWeek.mealsPlanned, ownerWeek.mealsMarked + (serverHad ? 0 : 1));
      const mealPart = m / ownerWeek.mealsPlanned;
      const pct =
        ownerWeek.sessionsPlanned
          ? (mealPart + Math.min(1, (ownerWeek.sessionsMarked ?? 0) / ownerWeek.sessionsPlanned)) / 2
          : mealPart;
      line += `، ${g("ونسبتكِ", "ونسبتك")} الآن ${arPct(pct)}`;
    }
    return line;
  }

  return (
    <>
      {ticket ? (
        <Ticket
          row={ticket}
          index={live.findIndex((r) => r.key === ticket.key)}
          total={live.length}
          isNow={MAIN_SLOTS.indexOf(ticket.slot as (typeof MAIN_SLOTS)[number]) === nowIdx}
          confirmed={justMarked === ticket.key}
          confirmText={confirmation(ticket)}
          busy={busyKey === ticket.key}
          solo={solo}
          wholeHouse={wholeHouse(ticket)}
          ownerSex={ownerSex}
          nameOf={nameOf}
          namesOf={namesOf}
          showAlternatives={showAlternatives}
          onAlternatives={() => setShowAlternatives((v) => !v)}
          onMark={(s) => markTicket(ticket, s)}
          onUndo={() => undoTicket(ticket)}
          cook={cook}
          dishCount={live.length}
        />
      ) : (
        <ClosedTicket
          dayName={dayName}
          cooked={cookedCount}
          total={live.length}
          openLeft={live.filter((r) => r.status === null).length}
          ownerSex={ownerSex}
          tomorrow={tomorrow}
        />
      )}

      {error && (
        <p role="alert" className="kt-error">
          {error}
        </p>
      )}

      {rest.length > 0 && (
        <>
          <div className="kt-sec-h">
            <h2 id="rest-title">{ticket ? "بقية سفرة اليوم" : "سفرة اليوم"}</h2>
            <Link href="/plan">
              الأسبوع كاملاً
              <ChevronLeft className="i" aria-hidden="true" />
            </Link>
          </div>
          <section className="kt-sheet" aria-labelledby="rest-title">
            {rest.map((row) => {
              const status = row.status;
              const busy = busyKey === row.key;
              const laterRow = status === null && isLater(row);
              return (
                <div key={row.key} className="kt-row">
                  <button
                    type="button"
                    onClick={() => toggleRow(row)}
                    disabled={busy}
                    aria-pressed={status !== null}
                    aria-label={
                      status === null
                        ? `${row.recipeName}: طبختها كما هي`
                        : `${row.recipeName}: ${STATUS_TAG[status]}، ${g("اضغطي", "اضغط")} للتراجع`
                    }
                    className={clsx(
                      "kt-tick",
                      status === "cooked" && "done",
                      (status === "swapped" || status === "skipped") && "other",
                      laterRow && "later",
                    )}
                  >
                    <i>
                      {busy ? (
                        <Loader2 className="i animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : status === "cooked" ? (
                        <Check className="i" aria-hidden="true" />
                      ) : status === "swapped" ? (
                        <Repeat2 className="i" aria-hidden="true" />
                      ) : status === "skipped" ? (
                        <Minus className="i" aria-hidden="true" />
                      ) : null}
                    </i>
                  </button>
                  <Link href="/plan" className="kt-rt">
                    <small>
                      {row.slotLabel}
                      {!solo && (
                        <>
                          <Sep />
                          {wholeHouse(row) ? "البيت كله" : namesOf(row.eaterIds)}
                        </>
                      )}
                    </small>
                    <strong>{row.recipeName}</strong>
                  </Link>
                  {status ? (
                    <span className={clsx("kt-tag", status !== "cooked" && "other")}>
                      {STATUS_TAG[status]}
                    </span>
                  ) : laterRow ? (
                    <span className="kt-when">{whenLabel(row)}</span>
                  ) : null}
                </div>
              );
            })}
            <p className="kt-sum">
              <span>
                طُبخ اليوم{" "}
                <b>
                  {arNum(cookedCount)} من {arNum(live.length)}
                </b>
              </span>
              {ownerDay && (
                <span>
                  {g("مجموع يومكِ", "مجموع يومك")} <b>{arNum(ownerDay.calories)}</b> من{" "}
                  <b>{arNum(ownerDay.target)}</b> سعرة
                </span>
              )}
            </p>
          </section>
        </>
      )}

      {workout}

      {ticket && hour >= 17 && tomorrow && tomorrow.rows.length > 0 && (
        <TomorrowRows dayName={tomorrow.dayName} rows={tomorrow.rows} />
      )}

      {toast && (
        <div role="status" className="kt-toast" data-float-bottom="">
          <span className="min-w-0 truncate">{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              toast.run();
              setToast(null);
            }}
          >
            {toast.action}
          </button>
        </div>
      )}
    </>
  );
}

function Ticket({
  row,
  index,
  total,
  isNow,
  confirmed,
  confirmText,
  busy,
  solo,
  wholeHouse,
  ownerSex,
  nameOf,
  namesOf,
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
  isNow: boolean;
  confirmed: boolean;
  confirmText: string;
  busy: boolean;
  solo: boolean;
  wholeHouse: boolean;
  ownerSex: string | null;
  nameOf: (id: string) => string;
  namesOf: (ids: readonly string[]) => string;
  showAlternatives: boolean;
  onAlternatives: () => void;
  onMark: (s: CheckinStatus) => void;
  onUndo: () => void;
  cook: KitchenCook | null;
  dishCount: number;
}) {
  const g = genderPick(ownerSex);
  const ownerEats = row.eaterIds.includes(OWNER_ID);
  const pot = row.shared && row.eaterIds.length > 1;
  const kcal = row.kcal != null ? <b>{arNum(row.kcal)}</b> : null;

  // «قدر واحد للبيت كله | حصتكِ ٦٥٠ سعرة» and its variants.
  let who: ReactNode;
  if (solo || (!pot && row.eaterIds.length === 1 && ownerEats)) {
    who = (
      <>
        {g("طبقكِ", "طبقك")}
        {kcal && (
          <>
            <Sep />
            {kcal} سعرة
          </>
        )}
      </>
    );
  } else if (!pot) {
    who = (
      <>
        طبق {namesOf(row.eaterIds)}
        {kcal && (
          <>
            <Sep />
            {kcal} سعرة
          </>
        )}
      </>
    );
  } else if (row.absentIds.length > 0) {
    who = (
      <>
        قدر واحد <b>{forCount(row.eaterIds.length)}</b>
        <Sep />
        {namesOf(row.absentIds)} خارج هذه الوجبة
      </>
    );
  } else {
    who = (
      <>
        قدر واحد <b>{wholeHouse ? "للبيت كله" : row.eaterIds.map((id) => forName(nameOf(id))).join(" و")}</b>
        {ownerEats && kcal && (
          <>
            <Sep />
            {g("حصتكِ", "حصتك")} {kcal} سعرة
          </>
        )}
      </>
    );
  }

  const credit = pot ? forAllOfYou(row.eaterIds.length) : null;
  const hasTimes = row.prepMinutes != null || row.cookMinutes != null;
  const meta = hasTimes ? (
    <p className="kt-meta">
      <Clock className="i" aria-hidden="true" />
      {row.prepMinutes != null && <>تحضير {countAr(row.prepMinutes, MINUTE_FORMS, arNum)}</>}
      {row.prepMinutes != null && row.cookMinutes != null && <Sep />}
      {row.cookMinutes != null && <>طبخ {countAr(row.cookMinutes, MINUTE_FORMS, arNum)}</>}
    </p>
  ) : null;

  const cookText = !cook
    ? null
    : cook.locale === "ar"
      ? row.recipeName
      : row.translatedName && row.translatedLocale === cook.locale
        ? row.translatedName
        : null;
  const cookFor = cook?.sex === "male" ? "له" : "لها";

  return (
    <section className="kt-ticket" aria-labelledby="t-dish">
      <div className={clsx("kt-head", !cook && "solo-end")}>
        <div className="kt-stamp">
          <p className="kt-slot">
            <b>{row.slotLabel}</b>
            <span>{isNow ? "وقته الآن" : "التالي في المطبخ"}</span>
          </p>
          <span className="kt-no">
            الطبق {arNum(index + 1)} من {arNum(total)}
          </span>
        </div>
        <h2 className="kt-dish" id="t-dish">
          {row.recipeName}
        </h2>
        <p className="kt-who">{who}</p>

        {row.shares.length > 1 && (
          <div
            className="kt-pot"
            role="img"
            aria-label={`نصيب كل فرد من القدر: ${row.shares
              .map((s) => `${s.id === OWNER_ID ? g("أنتِ", "أنتَ") : nameOf(s.id)} ${arNum(s.pct)}٪`)
              .join("، ")}`}
          >
            <p className="kt-pot-h">
              {row.absentIds.length > 0 ? "أُعيد توزيع القدر على الحاضرين" : "نصيب كل فرد من القدر"}
            </p>
            <div className="kt-bar" aria-hidden="true">
              {row.shares.map((s) => (
                <i key={s.id} className={clsx(`kt-w${Math.max(1, s.pct)}`, s.id === OWNER_ID && "you")} />
              ))}
            </div>
            <div className="kt-legend" aria-hidden="true">
              {row.shares.map((s) => (
                <span key={s.id} className={`kt-w${Math.max(1, s.pct)}`}>
                  <b>{arNum(s.pct)}٪</b>
                  {s.id === OWNER_ID ? g("أنتِ", "أنتَ") : nameOf(s.id)}
                </span>
              ))}
            </div>
          </div>
        )}

        {confirmed ? (
          <div role="status" className="kt-done">
            <span className="tickmark">
              <Check className="i" aria-hidden="true" />
            </span>
            <p>{confirmText}</p>
            <button type="button" onClick={onUndo} disabled={busy}>
              تراجع
            </button>
          </div>
        ) : isNow ? (
          <>
            <button type="button" className="kt-mark" onClick={() => onMark("cooked")} disabled={busy}>
              {busy ? (
                <Loader2 className="i animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Check className="i" aria-hidden="true" />
              )}
              طبختها كما هي
            </button>
            {showAlternatives ? (
              <div className="kt-choices">
                <button type="button" className="kt-choice" onClick={() => onMark("swapped")}>
                  بدّلتها
                </button>
                <button type="button" className="kt-choice" onClick={() => onMark("skipped")}>
                  تجاوزتها
                </button>
              </div>
            ) : null}
            <div className="kt-alt2">
              <button type="button" onClick={onAlternatives} aria-expanded={showAlternatives}>
                <ArrowRightLeft className="i" aria-hidden="true" />
                {showAlternatives ? "إخفاء الخيارين" : "بدّلتها أو تجاوزتها"}
              </button>
              <Link href="/plan">
                <BookOpen className="i" aria-hidden="true" />
                الوصفة
              </Link>
            </div>
            {credit && (
              <p className="kt-note">
                ضغطة واحدة تُحتسب <b>{credit}</b> في موسم بيتنا.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="kt-foot">
              {meta}
              <div className="kt-acts">
                <Link className="kt-btn primary" href="/plan">
                  <BookOpen className="i" aria-hidden="true" />
                  الوصفة والمقادير
                </Link>
                <Link className="kt-btn ghost" href="/chat">
                  <MessageCircle className="i" aria-hidden="true" />
                  {g("اسألي عنها", "اسأل عنها")}
                </Link>
              </div>
            </div>
            {credit && (
              <p className="kt-note">
                {g("سجّليها", "سجّلها")} بعد التقديم، فيُحتسب هذا الطبق <b>{credit}</b> في موسم بيتنا.
              </p>
            )}
          </>
        )}
      </div>

      {cook && (
        <div className="kt-stub">
          <div className="kt-cook">
            <span className="kt-cook-ico">
              <ChefHat className="i" aria-hidden="true" />
            </span>
            <div className="kt-cook-t">
              <strong>
                نسخة {cook.name} لليوم
                {cook.locale !== "ar" && <span className="kt-lang">{cook.languageAr}</span>}
              </strong>
              {cookText ? (
                cook.locale !== "ar" && (
                  <p lang={cook.locale} dir={cook.dir}>
                    {cookText}
                  </p>
                )
              ) : (
                <p className="pending">نجهّز ترجمة أطباق اليوم {forName(cook.name)}.</p>
              )}
              <small>{countAr(dishCount, DISH_FORMS, arNum)} بمقاديرها وخطواتها، جاهزة للطبخ</small>
            </div>
          </div>
          <div className="kt-cook-acts">
            <Link className="kt-cbtn out" href="/plan/housekeeper">
              <Smartphone className="i" aria-hidden="true" />
              {g(`افتحيها ${cookFor}`, `افتحها ${cookFor}`)}
            </Link>
            <Link className="kt-cbtn" href="/plan/housekeeper?print=1">
              <Printer className="i" aria-hidden="true" />
              {g("اطبعيها", "اطبعها")}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/** The day is answered: the ticket closes, with tomorrow as a read-only look ahead. */
function ClosedTicket({
  dayName,
  cooked,
  total,
  openLeft,
  ownerSex,
  tomorrow,
}: {
  dayName: string;
  cooked: number;
  total: number;
  openLeft: number;
  ownerSex: string | null;
  tomorrow: { dayName: string; rows: TodayRow[] } | null;
}) {
  const g = genderPick(ownerSex);
  const stars = starsForDay(cooked, total);
  const first = tomorrow?.rows[0];
  return (
    <section className="kt-ticket" aria-labelledby="t-dish">
      <div className="kt-head solo-end">
        <div className="kt-stamp">
          <p className="kt-slot">
            <b>سفرة {dayName}</b>
            <span>{openLeft === 0 ? "اكتملت" : "سُجّلت وجباتها الرئيسية"}</span>
          </p>
          {stars > 0 && (
            <span className="kt-stars" role="img" aria-label={`${arNum(stars)} من ٣ نجوم`}>
              {Array.from({ length: stars }, (_, i) => (
                <Star key={i} />
              ))}
            </span>
          )}
        </div>
        <h2 className="kt-dish" id="t-dish">
          طُبخ {arNum(cooked)} من {arNum(total)} كما هي
        </h2>
        <p className="kt-who">
          {openLeft > 0
            ? `${openLeft === 1 ? "بقيت وجبة" : openLeft === 2 ? "بقيت وجبتان" : `بقيت ${arNum(openLeft)} وجبات`} ${g("تسجّلينها", "تسجّلها")} من القائمة أدناه.`
            : stars === 3
              ? "أضاء اليوم بنجومه الثلاث لبيتكم."
              : "سُجّلت وجبات اليوم كلها."}
        </p>
        {first && tomorrow && (
          <div className="kt-tmrw">
            <small>
              غداً، {tomorrow.dayName}
              <Sep />
              للاطلاع
            </small>
            <strong>
              {first.slotLabel}: {first.recipeName}
            </strong>
            <Link href="/plan">
              الأسبوع كاملاً
              <ChevronLeft className="i" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/** «سفرة الغد» in the evening, while today's ticket is still open: read-only. */
function TomorrowRows({ dayName, rows }: { dayName: string; rows: TodayRow[] }) {
  return (
    <>
      <div className="kt-sec-h">
        <h2 id="tomorrow-title">سفرة الغد، {dayName}</h2>
        <Link href="/plan">
          للاطلاع
          <ChevronLeft className="i" aria-hidden="true" />
        </Link>
      </div>
      <section className="kt-sheet" aria-labelledby="tomorrow-title">
        {rows.map((r) => (
          <div key={r.key} className="kt-row">
            <span className="kt-rt ps-1.5">
              <small>{r.slotLabel}</small>
              <strong>{r.recipeName}</strong>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
