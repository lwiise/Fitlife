import Link from "next/link";
import { clsx } from "clsx";
import { Crown, Target } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Ring } from "@/components/ui/ring";
import { arNum, arPct } from "@/lib/copy/numbers";
import { countAr, DAY_FORMS, MEAL_FORMS } from "@/lib/copy/plural";
import { dayNameFromWeekStart } from "@/lib/plans/dayMapping";
import { mealsToPass } from "@/lib/engagement/raceGap";
import type { SeasonStats } from "@/lib/engagement/seasonMath";
import type { FamilySeasonProps } from "@/lib/engagement/seasonProps";

// «موسم بيتنا», kitchen-ticket edition (09/2026). Every number still comes
// from computeSeasonStats: only «طبختها كما هي» counts, the whole household
// competes (children included), the housekeeper never appears, and #1 is
// crowned (owner directives 07/2026). What changed is that it reads as a
// race: the week with its denominator, readable day names, the leader on a
// gold stage, and under everyone else the meals it would take to move up.

/** «السبت» → «سبت»: short enough for seven cells at 360px, still a word. */
function shortDay(weekStart: string | undefined, dayIndex: number) {
  const full = weekStart ? dayNameFromWeekStart(weekStart, dayIndex) : "";
  return full.startsWith("ال") ? full.slice(2) : full || arNum(dayIndex + 1);
}

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true">
      <path
        d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z"
        fill={on ? "var(--color-brand-yellow)" : "rgb(255 255 255 / 0.28)"}
      />
    </svg>
  );
}

const BAR_WIDTH = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
  "w-[35%]", "w-[40%]", "w-[45%]", "w-1/2", "w-[55%]", "w-[60%]", "w-[65%]",
  "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
];
const barWidth = (pct: number) => BAR_WIDTH[Math.round(Math.min(1, Math.max(0, pct)) * 20)]!;

export function SeasonBoard({
  props,
  stats,
}: {
  props: FamilySeasonProps;
  stats: SeasonStats;
}) {
  const { followedMeals, activeDays, fillFrac, hasActivity, days, ranked, hasWinner } = stats;
  const sexById = new Map(props.members.map((m) => [m.id, m.sex ?? null]));
  const plannedTotal = props.plannedMealsPerDay.reduce((n, d) => n + d, 0);
  const leader = hasWinner ? ranked[0] : undefined;
  const others = hasWinner ? ranked.slice(1) : ranked;

  const counts = (m: (typeof ranked)[number]) =>
    [
      `${arNum(m.mealsMarked)} من ${arNum(m.mealsPlanned)} وجبة`,
      m.sessionsPlanned !== undefined
        ? `${arNum(m.sessionsMarked ?? 0)} من ${arNum(m.sessionsPlanned)} حصص تمرين`
        : null,
    ].filter(Boolean);

  return (
    <section
      id="season"
      aria-labelledby="season-heading"
      className="scroll-mt-[calc(var(--app-header-h)+1rem)] rounded-[1.375rem] border border-brand-line bg-brand-card p-4 sm:p-5"
    >
      <h2 id="season-heading" className="text-[1.625rem] font-extrabold leading-tight text-brand-pink">
        موسم بيتنا
      </h2>

      <div className="mt-3 flex items-center gap-4">
        <Ring
          frac={fillFrac}
          className="size-20"
          label={`طبخ بيتكم ${countAr(followedMeals, MEAL_FORMS)} كما هي هذا الأسبوع`}
        >
          <b className="text-2xl font-extrabold leading-none text-brand-purple-900 tabular-nums">
            {arNum(followedMeals)}
          </b>
          <small className="mt-0.5 text-[13px] text-brand-ink-muted">
            {followedMeals >= 3 && followedMeals <= 10 ? "وجبات" : "وجبة"}
          </small>
        </Ring>
        <p className="min-w-0 text-base leading-relaxed text-brand-ink">
          {hasActivity ? (
            <>
              طبخ بيتكم <b>{countAr(followedMeals, MEAL_FORMS, arNum)}</b> كما هي
              {plannedTotal > 0 && <> من {arNum(plannedTotal)} في الخطة</>}، وأضاء{" "}
              <b>{countAr(activeDays, DAY_FORMS, arNum)}</b> من ٧.
            </>
          ) : (
            <>يبدأ موسمكم بأول وجبة تطبخونها كما هي من الخطة.</>
          )}
        </p>
      </div>

      <ul aria-label="أيام الأسبوع" className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = props.todayIndex === d.dayIndex;
          const isFuture = props.todayIndex != null && d.dayIndex > props.todayIndex;
          const name = shortDay(props.weekStartDate, d.dayIndex);
          const spoken = d.lit
            ? d.complete
              ? "طُبخت وجبات اليوم كلها كما هي"
              : `طُبخ ${arNum(d.cookedMeals)} من ${arNum(d.plannedMeals)}`
            : isFuture
              ? "لم يأتِ بعد"
              : "بلا تسجيل";
          return (
            <li key={d.dayIndex} className="flex flex-col items-center gap-1">
              <span
                role="img"
                aria-label={`${isToday ? "اليوم" : name}: ${spoken}`}
                className={clsx(
                  "flex h-10 w-full items-center justify-center gap-px rounded-xl",
                  d.lit && "bg-brand-purple-900",
                  d.lit && isToday && "ring-2 ring-brand-purple-900 ring-offset-2 ring-offset-brand-card",
                  !d.lit && isToday && "border-2 border-brand-purple-900",
                  !d.lit && !isToday && isFuture && "border border-dashed border-brand-ink/25",
                  !d.lit && !isToday && !isFuture && "border border-brand-ink/25",
                )}
              >
                {d.lit && [0, 1, 2].map((s) => <Star key={s} on={s < d.stars} />)}
              </span>
              <span
                aria-hidden="true"
                className={clsx(
                  "text-[13px] font-bold leading-tight",
                  isToday ? "text-brand-purple-900" : "text-brand-ink-muted",
                )}
              >
                {isToday ? "اليوم" : name}
              </span>
            </li>
          );
        })}
      </ul>

      {hasActivity && (
        <div className="mt-5 space-y-2">
          {leader && (
            <Link
              href={`/plan?member=${leader.id}`}
              className="block rounded-2xl border border-gold-line bg-gold-soft p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            >
              <div className="flex items-center gap-3">
                <Crown className="size-6 shrink-0 text-[#9A6B00]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-extrabold text-brand-ink">{leader.name}</p>
                  <p className="text-meta font-bold text-[#7A5500]">
                    {sexById.get(leader.id) === "male" ? "فائز هذا الأسبوع" : "فائزة هذا الأسبوع"}
                  </p>
                </div>
                <b className="text-[2rem] font-extrabold leading-none text-brand-ink tabular-nums">
                  {arPct(leader.pct)}
                </b>
              </div>
              <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/70">
                <span className={clsx("block h-full rounded-full bg-brand-yellow", barWidth(leader.pct))} />
              </span>
              <p className="mt-2 text-meta text-brand-ink-muted">{counts(leader).join("، ")}</p>
            </Link>
          )}

          <ol className="divide-y divide-brand-line" start={leader ? 2 : 1}>
            {others.map((m, i) => {
              const rank = (leader ? 2 : 1) + i;
              const above = hasWinner ? ranked[rank - 2] : undefined;
              const gap = above ? mealsToPass(m, above) : null;
              const male = sexById.get(m.id) === "male";
              const gapLine =
                gap != null && above
                  ? `${gap === 1 ? "وجبة واحدة" : gap === 2 ? "وجبتان" : countAr(gap, MEAL_FORMS, arNum)} ${
                      male ? "ويسبق" : "وتسبق"
                    } ${above.name}`
                  : null;
              return (
                <li key={m.id}>
                  <Link
                    href={`/plan?member=${m.id}`}
                    className="flex items-center gap-3 rounded-xl py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <span className="w-4 text-center text-base font-extrabold text-brand-ink-muted tabular-nums">
                      {arNum(rank)}
                    </span>
                    <Avatar name={m.name} rosterIndex={m.rosterIndex} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-base font-extrabold text-brand-ink">{m.name}</span>
                        <b className="text-[1.0625rem] font-extrabold text-brand-ink tabular-nums">
                          {arPct(m.pct)}
                        </b>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brand-tint">
                        <span className={clsx("block h-full rounded-full bg-brand-purple-900", barWidth(m.pct))} />
                      </span>
                      <span className="mt-1 flex flex-wrap justify-between gap-x-3 text-meta text-brand-ink-muted">
                        <span>{counts(m).join("، ")}</span>
                        {gapLine && <span className="font-bold text-brand-purple-900">{gapLine}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {props.goalReached.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-meta font-bold text-success">
          <Target className="size-4" aria-hidden="true" />
          {props.goalReached.map((m) => m.name).join(" و")}: تحقّق الهدف
        </p>
      )}

      <p className="mt-3 text-meta text-brand-ink-muted">
        النسبة: ما طُبخ كما هو من وجبات خطة كل فرد هذا الأسبوع، ولمن له برنامج تمارين نصفها للوجبات
        ونصفها للحصص.
      </p>
    </section>
  );
}
