import Link from "next/link";
import { clsx } from "clsx";
import { Target } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { arNum, arPct } from "@/lib/copy/numbers";
import { countAr, DAY_FORMS, MEAL_FORMS } from "@/lib/copy/plural";
import { dayNameFromWeekStart } from "@/lib/plans/dayMapping";
import { mealsToPass } from "@/lib/engagement/raceGap";
import type { SeasonStats } from "@/lib/engagement/seasonMath";
import type { FamilySeasonProps } from "@/lib/engagement/seasonProps";

// «موسم بيتنا», kitchen-ticket edition (09/2026), built to the approved
// mockup. Every number still comes from computeSeasonStats: only «طبختها كما
// هي» counts, the whole household competes (children included), the
// housekeeper never appears, and #1 is crowned (owner directives 07/2026). It
// reads as a race: the week with its denominator, readable day names, the
// leader on a gold stage, and under everyone else the meals it would take to
// move up.

/** «السبت» → «سبت»: short enough for seven cells at 360px, still a word. */
function shortDay(weekStart: string | undefined, dayIndex: number) {
  const full = weekStart ? dayNameFromWeekStart(weekStart, dayIndex) : "";
  return full.startsWith("ال") ? full.slice(2) : full || arNum(dayIndex + 1);
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" fill="#F2BB16" />
    </svg>
  );
}

function Crown() {
  return (
    <span className="kt-crown" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M3.5 17.5 2 7.5l5.2 3.8L12 4l4.8 7.3L22 7.5l-1.5 10z" fill="#F2BB16" />
        <rect x="3.5" y="19" width="17" height="2.2" rx="1.1" fill="#D4A017" />
      </svg>
    </span>
  );
}

const pctClass = (frac: number) => `kt-p${Math.round(Math.min(1, Math.max(0, frac)) * 100)}`;

function Sep() {
  return <i className="sep" aria-hidden="true" />;
}

export function SeasonBoard({
  props,
  stats,
  photos,
}: {
  props: FamilySeasonProps;
  stats: SeasonStats;
  /** Profile photo URL per member id (householdPhotoSrcs). */
  photos?: Readonly<Record<string, string>>;
}) {
  const { followedMeals, activeDays, fillFrac, hasActivity, days, ranked, hasWinner } = stats;
  const sexById = new Map(props.members.map((m) => [m.id, m.sex ?? null]));
  const plannedTotal = props.plannedMealsPerDay.reduce((n, d) => n + d, 0);
  const leader = hasWinner ? ranked[0] : undefined;
  const others = hasWinner ? ranked.slice(1) : ranked;
  const anyWorkout = ranked.some((m) => m.sessionsPlanned !== undefined);

  const counts = (m: (typeof ranked)[number], short = false) => (
    <>
      {arNum(m.mealsMarked)} من {arNum(m.mealsPlanned)} وجبة
      {m.sessionsPlanned !== undefined && (
        <>
          <Sep />
          {arNum(m.sessionsMarked ?? 0)} من {arNum(m.sessionsPlanned)} {short ? "حصص" : "حصص تمرين"}
        </>
      )}
    </>
  );

  // Ring: r=32, stroke 7, on a 76 box (scaled up on desktop by CSS).
  const C = 2 * Math.PI * 32;
  const len = Math.max(0, Math.min(1, fillFrac)) * C;

  return (
    <section className="kt-season" id="season" aria-labelledby="season-heading">
      <div className="kt-season-top">
        <div className="txt">
          <h2 id="season-heading">موسم بيتنا</h2>
          <p>
            {hasActivity ? (
              <>
                طبخ بيتكم <b>{countAr(followedMeals, MEAL_FORMS, arNum)}</b> كما هي
                {plannedTotal > 0 && (
                  <>
                    {" "}
                    من&nbsp;<b>{arNum(plannedTotal)}</b> في الخطة
                  </>
                )}
                ، وأضاء <b>{countAr(activeDays, DAY_FORMS, arNum)}</b> من&nbsp;٧.
              </>
            ) : (
              <>يبدأ موسمكم بأول وجبة تطبخونها كما هي من الخطة.</>
            )}
          </p>
        </div>
        {hasActivity && (
          <div
            className="kt-ring"
            role="img"
            aria-label={`طبخ بيتكم ${countAr(followedMeals, MEAL_FORMS, arNum)} كما هي هذا الأسبوع`}
          >
            <svg viewBox="0 0 76 76" aria-hidden="true">
              <circle cx="38" cy="38" r="32" fill="none" stroke="#DCD6E8" strokeWidth="7" />
              {len > 0 && (
                <circle
                  cx="38"
                  cy="38"
                  r="32"
                  fill="none"
                  stroke="#4E2490"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${len.toFixed(1)} ${(C - len + 1).toFixed(1)}`}
                />
              )}
            </svg>
            <div aria-hidden="true">
              <b>{arNum(followedMeals)}</b>
              <small>{followedMeals >= 3 && followedMeals <= 10 ? "وجبات" : "وجبة"}</small>
            </div>
          </div>
        )}
      </div>

      <ul className="kt-days" aria-label="أيام الأسبوع">
        {days.map((d) => {
          const isToday = props.todayIndex === d.dayIndex;
          const isFuture = props.todayIndex != null && d.dayIndex > props.todayIndex;
          const name = shortDay(props.weekStartDate, d.dayIndex);
          const spoken = d.lit
            ? d.complete
              ? "طُبخت وجبات اليوم كلها"
              : `طُبخ ${arNum(d.cookedMeals)} من ${arNum(d.plannedMeals)}`
            : isFuture
              ? "لم يأتِ بعد"
              : "بلا تسجيل";
          return (
            <li
              key={d.dayIndex}
              className={clsx(
                "kt-day",
                d.lit && "lit",
                isToday && "today",
                !d.lit && !isToday && (isFuture ? "future" : "past"),
              )}
            >
              <span className="kt-cell" role="img" aria-label={`${isToday ? "اليوم" : name}: ${spoken}`}>
                {d.lit && Array.from({ length: d.stars }, (_, i) => <Star key={i} />)}
              </span>
              <span aria-hidden="true">{isToday ? "اليوم" : name}</span>
            </li>
          );
        })}
      </ul>
      <p className="kt-days-note">
        يضيء اليوم بأول وجبة تُطبخ فيه كما هي، وتكتمل نجومه الثلاث حين تُطبخ وجباته كلها.
      </p>

      {hasActivity && (
        <div className="kt-board">
          {leader && (
            <Link href={`/plan?member=${leader.id}`} className="kt-lead-card">
              <div className="kt-lead-top">
                {photos?.[leader.id] ? (
                  <span className="kt-lead-face" aria-hidden="true">
                    <Avatar
                      name={leader.name}
                      rosterIndex={leader.rosterIndex}
                      src={photos[leader.id]}
                      size="lg"
                      className="size-11"
                    />
                    <Crown />
                  </span>
                ) : (
                  <Crown />
                )}
                <div className="kt-lead-nm">
                  <strong>{leader.name}</strong>
                  <small>{sexById.get(leader.id) === "male" ? "فائز هذا الأسبوع" : "فائزة هذا الأسبوع"}</small>
                </div>
                <span className="kt-lead-p">{arPct(leader.pct)}</span>
              </div>
              <div className="kt-lbar">
                <b className={pctClass(leader.pct)} />
              </div>
              <p className="kt-lead-c">{counts(leader)}</p>
            </Link>
          )}

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
              <Link key={m.id} href={`/plan?member=${m.id}`} className="kt-rk">
                <span className="n">{arNum(rank)}</span>
                <Avatar name={m.name} rosterIndex={m.rosterIndex} src={photos?.[m.id]} />
                <strong>{m.name}</strong>
                <span className="p">{arPct(m.pct)}</span>
                <span className="sbar">
                  <b className={pctClass(m.pct)} />
                </span>
                <small>
                  <span>{counts(m, true)}</span>
                  {gapLine && <span>{gapLine}</span>}
                </small>
              </Link>
            );
          })}
        </div>
      )}

      {props.goalReached.length > 0 && (
        <p className="kt-goal">
          <Target className="i" aria-hidden="true" />
          {props.goalReached.map((m) => m.name).join(" و")}: تحقّق الهدف
        </p>
      )}

      {hasActivity && (
        <p className="kt-board-note">
          النسبة: ما طُبخ كما هو من وجبات خطة كل فرد.
          {anyWorkout && " ولمن له برنامج تمارين، نصف النسبة للوجبات ونصفها للحصص."}
        </p>
      )}
    </section>
  );
}
