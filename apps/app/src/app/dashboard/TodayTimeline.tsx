"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, Loader2, Undo2 } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import {
  setMealCheckin,
  setSharedMealCheckin,
} from "@/lib/engagement/actions";
import type { CheckinStatus } from "@/lib/engagement/types";
import { OWNER_ID, type TodayRow } from "@/lib/dashboard/todayTable";

const STATUS_LABEL: Record<CheckinStatus, string> = {
  cooked: "طُبخت كما هي",
  swapped: "بُدّلت",
  skipped: "لم تُطبخ",
};

export interface TimelinePerson {
  id: string;
  name: string;
  rosterIndex: number;
}

/** «لـفهد» with the article folded in: «الجدة» → «للجدة». */
function forName(name: string) {
  const n = name.trim();
  return n.startsWith("ال") ? `ل${n.slice(1)}` : `ل${n}`;
}

/**
 * «سفرة اليوم» — today's dishes as one timeline for the whole table. The next
 * unmarked dish carries the screen's single primary action, «طبختها كما هي»,
 * which writes exactly the mark /plan writes (same server actions, same
 * roster), so the family season updates on the next render.
 */
export function TodayTimeline({
  planId,
  dayIndex,
  rows,
  people,
  ownerSex,
  householdSize,
}: {
  planId: string;
  dayIndex: number;
  rows: TodayRow[];
  people: TimelinePerson[];
  ownerSex: string | null;
  /** Everyone on the roster — a dish all of them eat reads «للبيت كله». */
  householdSize: number;
}) {
  const g = genderPick(ownerSex);
  const router = useRouter();
  const [overrides, setOverrides] = useState<Map<string, CheckinStatus | null>>(
    () => new Map(),
  );
  const [justMarked, setJustMarked] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byId = new Map(people.map((p) => [p.id, p]));
  const statusOf = (r: TodayRow) =>
    overrides.has(r.key) ? overrides.get(r.key)! : r.status;
  const nextKey = rows.find((r) => statusOf(r) === null)?.key ?? null;
  const solo = householdSize <= 1;

  function mark(row: TodayRow, status: CheckinStatus | null) {
    const before = statusOf(row);
    setOverrides((m) => new Map(m).set(row.key, status));
    setJustMarked(status ? row.key : null);
    setBusyKey(row.key);
    setError(null);
    const write = row.shared
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
    write
      .then((res) => {
        if (!res.ok) {
          setOverrides((m) => new Map(m).set(row.key, before));
          setJustMarked(null);
          setError(res.error);
          return;
        }
        // Summary line + season board are server-rendered: re-read them.
        startTransition(() => router.refresh());
      })
      .catch(() => {
        setOverrides((m) => new Map(m).set(row.key, before));
        setJustMarked(null);
        setError(
          g(
            "تعذّر حفظ التسجيل. تحقّقي من الاتصال وحاولي مرة أخرى.",
            "تعذّر حفظ التسجيل. تحقّق من الاتصال وحاول مرة أخرى.",
          ),
        );
      })
      .finally(() => setBusyKey(null));
  }

  function whoLine(row: TodayRow) {
    if (solo) return null;
    const everyone = row.eaterIds.length >= householdSize;
    const text = everyone
      ? "للبيت كله"
      : row.eaterIds
          .map((id, i) => {
            const part = id === OWNER_ID ? g("لكِ", "لك") : forName(byId.get(id)?.name ?? "");
            return i === 0 ? part : `و${part}`;
          })
          .join(" ");
    const eaters = row.eaterIds
      .map((id) => byId.get(id))
      .filter((p): p is TimelinePerson => !!p);
    return (
      <div className="mt-1.5 flex items-center gap-2 text-meta text-brand-ink-muted">
        <AvatarStack people={eaters} />
        <span>
          {text}
          {row.shared && row.eaterIds.length > 1 ? " · طبخة واحدة" : ""}
        </span>
      </div>
    );
  }

  function kcalLabel(row: TodayRow) {
    if (row.kcalFor === OWNER_ID) return solo ? "سعرة" : g("سعرة لكِ", "سعرة لك");
    const name = row.kcalFor ? byId.get(row.kcalFor)?.name : null;
    return name ? `سعرة ${forName(name)}` : "سعرة";
  }

  return (
    <>
      <ol className="relative mt-1 before:absolute before:inset-y-5 before:start-[11px] before:w-0.5 before:rounded-full before:bg-brand-line">
        {rows.map((row) => {
          const status = statusOf(row);
          const isNext = row.key === nextKey;
          const busy = busyKey === row.key;
          return (
            <li
              key={row.key}
              className={clsx(
                "relative grid grid-cols-[1.5rem_1fr_auto] gap-x-3 py-3",
                isNext && "-mx-2 rounded-2xl bg-brand-tint/60 px-2",
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "relative z-[1] mt-0.5 grid size-6 place-items-center rounded-full",
                  status === "cooked" && "bg-success text-white",
                  status && status !== "cooked" && "bg-brand-ink-muted/70 text-white",
                  !status && isNext && "border-[2.5px] border-brand-purple-900 bg-brand-card",
                  !status && !isNext && "border-2 border-brand-ink/20 bg-brand-card",
                )}
              >
                {status && <Check className="size-3.5" strokeWidth={3} />}
              </span>

              <div className="min-w-0">
                <p className="text-meta font-bold text-brand-ink-muted">
                  {row.slotLabel}
                  {status && (
                    <>
                      {" · "}
                      <span className={status === "cooked" ? "text-success" : undefined}>
                        {STATUS_LABEL[status]}
                      </span>
                    </>
                  )}
                  {isNext && (
                    <span className="ms-2 rounded-full bg-brand-purple-900 px-2 py-0.5 text-[13px] text-white">
                      التالية
                    </span>
                  )}
                </p>
                <p
                  className={clsx(
                    "mt-0.5 text-app-item",
                    status ? "text-brand-ink/70" : "text-brand-ink",
                  )}
                >
                  {row.recipeName}
                </p>
                {whoLine(row)}
              </div>

              {row.kcal != null && (
                <div className="text-end">
                  <b className="block text-lg font-extrabold leading-tight text-brand-ink tabular-nums">
                    {arNum(row.kcal)}
                  </b>
                  <small className="text-meta text-brand-ink-muted">{kcalLabel(row)}</small>
                </div>
              )}

              {isNext && (
                <div className="col-span-2 col-start-2 mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => mark(row, "cooked")}
                    className={buttonClasses({ variant: "primary" })}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    طبختها كما هي
                  </button>
                  <Link href="/plan" className={buttonClasses({ variant: "secondary" })}>
                    الوصفة والمقادير
                  </Link>
                </div>
              )}

              {justMarked === row.key && status && (
                <div className="col-span-2 col-start-2 mt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => mark(row, null)}
                    className="-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-meta font-bold text-brand-purple-900 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                    تراجع عن التسجيل
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-meta font-bold text-critical">
          {error}
        </p>
      )}
      {!nextKey && rows.length > 0 && (
        <p role="status" className="mt-2 text-meta text-brand-ink-muted">
          {g(
            "سجّلتِ وجبات اليوم كلها. لتعديل أي تسجيل افتحي الخطة.",
            "سجّلتَ وجبات اليوم كلها. لتعديل أي تسجيل افتح الخطة.",
          )}
        </p>
      )}
    </>
  );
}
