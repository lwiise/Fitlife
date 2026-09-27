import Link from "next/link";
import { clsx } from "clsx";
import { Crown, Target, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { arNum, arPct } from "@/lib/copy/numbers";
import { countAr, DAY_FORMS, MEAL_FORMS } from "@/lib/copy/plural";
import type { SeasonStats } from "@/lib/engagement/seasonMath";
import type { FamilySeasonProps } from "@/lib/engagement/seasonProps";

// «موسم بيتنا», dashboard edition (09/2026 redesign). Same numbers as ever —
// every figure comes from computeSeasonStats, so only «طبختها كما هي» counts,
// the whole household competes (children included), the housekeeper never
// appears and #1 is crowned (owner directives 07/2026). What changed is the
// presentation: flat brand colours, 16px names, one plain line explaining the
// percentage.

const DAY_INITIALS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // getUTCDay, 0 = Sunday

function weekdayInitial(weekStart: string | undefined, dayIndex: number) {
  if (!weekStart) return arNum(dayIndex + 1);
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return arNum(dayIndex + 1);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return DAY_INITIALS[d.getUTCDay()] ?? "";
}

export function SeasonBoard({
  props,
  stats,
}: {
  props: FamilySeasonProps;
  stats: SeasonStats;
}) {
  const { followedMeals, activeDays, honored, fillFrac, hasActivity, days, ranked, hasWinner } =
    stats;
  const sexById = new Map(props.members.map((m) => [m.id, m.sex ?? null]));

  return (
    <Card aria-labelledby="season-heading">
      <CardHeader
        id="season-heading"
        title="موسم بيتنا"
        icon={<Trophy className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      <div className="flex items-center gap-4">
        <Ring
          frac={fillFrac}
          label={`طبخ بيتكم ${countAr(followedMeals, MEAL_FORMS)} كما هي هذا الأسبوع`}
        >
          <b className="text-2xl font-extrabold leading-none text-brand-purple-900 tabular-nums">
            {arNum(followedMeals)}
          </b>
          <small className="mt-0.5 text-[13px] text-brand-ink-muted">وجبة</small>
        </Ring>
        <div className="min-w-0">
          {hasActivity ? (
            <p className="text-base leading-relaxed text-brand-ink">
              أضاء بيتكم <b>{countAr(activeDays, DAY_FORMS, arNum)}</b> من ٧ هذا الأسبوع.
            </p>
          ) : (
            <p className="text-base leading-relaxed text-brand-ink">
              يبدأ موسمكم بأول وجبة تطبخونها كما هي من الخطة.
            </p>
          )}
          {honored && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold-line bg-gold-soft px-3 py-1 text-meta font-extrabold text-brand-ink">
              <Crown className="size-4 text-[#9A6B00]" aria-hidden="true" />
              أتممتم موسمكم
            </span>
          )}
        </div>
      </div>

      <ul aria-label="أيام الأسبوع" className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = props.todayIndex === d.dayIndex;
          const initial = weekdayInitial(props.weekStartDate, d.dayIndex);
          const spoken = d.lit
            ? d.complete
              ? "طُبخت وجبات اليوم كلها"
              : d.plannedMeals > 0
                ? `طُبخ ${arNum(d.cookedMeals)} من ${arNum(d.plannedMeals)}`
                : "طُبخ من الخطة"
            : isToday
              ? "اليوم، بانتظار التسجيل"
              : "بلا تسجيل";
          return (
            <li key={d.dayIndex} className="flex flex-col items-center gap-1">
              <span
                role="img"
                aria-label={`${initial}: ${spoken}`}
                className={clsx(
                  "grid h-10 w-full place-items-center rounded-xl text-[13px] font-extrabold",
                  d.lit && "bg-brand-purple-900 text-brand-yellow",
                  !d.lit && isToday && "border-2 border-brand-purple-900 bg-brand-card",
                  !d.lit && !isToday && "bg-brand-tint/60",
                )}
              >
                {d.lit ? "★".repeat(Math.max(1, d.stars)) : ""}
              </span>
              <span
                aria-hidden="true"
                className={clsx(
                  "text-[13px] font-bold",
                  isToday ? "text-brand-purple-900" : "text-brand-ink-muted",
                )}
              >
                {isToday ? "اليوم" : initial}
              </span>
            </li>
          );
        })}
      </ul>

      {hasActivity && (
        <ol aria-label="ترتيب الأسبوع" className="mt-4 space-y-1.5">
          {ranked.map((m, idx) => {
            const winner = hasWinner && idx === 0;
            const female = sexById.get(m.id) === "female";
            return (
              <li key={m.id}>
                <Link
                  href={`/plan?member=${m.id}`}
                  className={clsx(
                    "flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900",
                    winner
                      ? "border border-gold-line bg-gold-soft"
                      : "hover:bg-brand-tint/60",
                  )}
                >
                  <span className="w-5 text-center text-base font-extrabold text-brand-ink-muted tabular-nums">
                    {arNum(idx + 1)}
                  </span>
                  <Avatar name={m.name} rosterIndex={m.rosterIndex} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-1.5 text-base font-extrabold text-brand-ink">
                      <span className="truncate">{m.name}</span>
                      {winner && (
                        <span className="inline-flex items-center gap-1 text-meta font-bold text-[#7A5500]">
                          <Crown className="size-3.5" aria-hidden="true" />
                          {female ? "فائزة هذا الأسبوع" : "فائز هذا الأسبوع"}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-brand-tint">
                      <span
                        className={clsx(
                          "block h-full rounded-full",
                          winner ? "bg-brand-yellow" : "bg-brand-purple-900",
                          // Width buckets in 5% steps: static classes keep the
                          // bar CSS-only (no inline style).
                          BAR_WIDTH[Math.round(Math.min(1, m.pct) * 20)],
                        )}
                      />
                    </span>
                  </span>
                  <span className="text-base font-extrabold text-brand-ink tabular-nums">
                    {arPct(m.pct)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {props.goalReached.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-meta font-bold text-success">
          <Target className="size-4" aria-hidden="true" />
          {props.goalReached.map((m) => m.name).join(" و")}: تحقّق الهدف
        </p>
      )}

      <p className="mt-3 text-meta text-brand-ink-muted">
        النسبة: ما أُتمّ من خطة كل فرد هذا الأسبوع. تُحتسب الوجبة المطبوخة كما هي فقط.
      </p>
    </Card>
  );
}

const BAR_WIDTH = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
];
