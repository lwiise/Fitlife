import { Trophy, Crown } from "lucide-react";

// «موسم بيتنا» — the family season, rendered as a competitive LEADERBOARD.
//
// OWNER DECISION (07/2026): the account owner reviewed the cooperative
// «بيتنا يُضيء» build and the family-engagement research (which recommended a
// cooperative, no-ranking shape for this audience — see
// product/family-engagement-research-and-plan.md §5 and
// product/engagement-layer-brainstorm.md §6) and DIRECTED a head-to-head ranked
// leaderboard instead (the original brief in the research doc §0). This
// component implements that explicit decision: a per-member ranking with a
// celebrated #1 "winner", per-person weekly percentages, and rank numbers.
// The cooperative guardrails (no last-place framing, no per-person numbers) are
// intentionally SUPERSEDED here by owner direction; the research remains on file.
//
// Structure:
//   • Top card — the shared header: a family meal-total ring, the week's pride
//     line, the most-consistent member, and a 7-day meal strip (a day the house
//     cooked lights up with a star rating + a utensils mark; other days dashed).
//   • Leaderboard — every eligible adult ranked by weekly participation
//     (meal marks + verdicts + workout marks). #1 gets the gold winner card with
//     a crown and a «فائز هذا الأسبوع» badge; the rest are purple rank cards.
// Adults only (children/housekeeper are never in `members`); the caller hides it
// for solo households and read-only/translated views.

const HONOR_DAYS_GOAL = 5; // meal days in a week to "honor" the season
const CAP = 14; // invisible capacity the family meal ring fills toward
const WEEKLY_TARGET = 10; // per-member denominator for the leaderboard %

const DAY_INITIALS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // getUTCDay 0=Sun

const ar = (n: number) =>
  new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);
const pctFmt = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  maximumFractionDigits: 0,
});

function weekdayInitial(weekStartDate: string | undefined, dayIndex: number) {
  if (!weekStartDate) return ar(dayIndex + 1);
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ar(dayIndex + 1);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return DAY_INITIALS[d.getUTCDay()] ?? "";
}

/** An LTR-isolated numeral, so bidi never reverses a count inside the RTL frame. */
function Figure({ n }: { n: number }) {
  return (
    <span dir="ltr" className="tabular-nums">
      {ar(n)}
    </span>
  );
}

/** Arabic agreement (1 / 2 / 3-10 / 11+); the figure stays emphasised. */
function Count({
  n,
  one,
  two,
  few,
  many,
}: {
  n: number;
  one: string;
  two: string;
  few: string;
  many: string;
}) {
  if (n === 1) return <strong className="font-extrabold text-brand-purple-900">{one}</strong>;
  if (n === 2) return <strong className="font-extrabold text-brand-purple-900">{two}</strong>;
  return (
    <>
      <strong className="font-extrabold text-brand-purple-900">
        <Figure n={n} />
      </strong>{" "}
      {n <= 10 ? few : many}
    </>
  );
}

/** A single progress ring (track + rounded fill arc), sized by radius/stroke. */
function Ring({
  frac,
  color,
  track,
  sw,
  r,
}: {
  frac: number;
  color: string;
  track: string;
  sw: number;
  r: number;
}) {
  const size = 2 * (r + sw);
  const c = r + sw;
  const C = 2 * Math.PI * r;
  const len = Math.min(1, frac) * C;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[clamp(9px,1.4vw,14px)]" aria-hidden="true">
      <path
        d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7L12 17.6 5.9 20.3l1.5-6.7L2.3 9l6.8-.7z"
        fill={filled ? "var(--color-brand-yellow)" : "rgba(255,255,255,0.28)"}
      />
    </svg>
  );
}

function UtensilsMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[clamp(16px,2.4vw,26px)] text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />
    </svg>
  );
}

/** The decorative gold crown resting on top of the winner card. */
function WinnerCrown() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute -top-6 start-1/2 -translate-x-1/2 w-14 h-11 drop-shadow-[0_6px_8px_rgba(180,120,0,0.45)]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8l4.5 4L12 4l4.5 8L21 8l-1.8 10H4.8L3 8z"
        fill="#F5C022"
        stroke="#C98A0E"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <circle cx={3} cy={8} r={1.6} fill="#F5C022" stroke="#C98A0E" strokeWidth={1} />
      <circle cx={21} cy={8} r={1.6} fill="#F5C022" stroke="#C98A0E" strokeWidth={1} />
      <circle cx={12} cy={4} r={1.6} fill="#F5C022" stroke="#C98A0E" strokeWidth={1} />
    </svg>
  );
}

type Mark = {
  day_index: number;
  slot: string;
  status?: string;
  member_id?: string | null;
};
type VerdictMark = { verdict?: string; member_id?: string | null };
type WorkoutMark = {
  day_index?: number;
  member_id?: string | null;
  status: string;
};

export function FamilySeasonCard({
  members,
  checkins,
  verdicts,
  workoutCheckins = [],
  goalReached = [],
  weekStartDate,
}: {
  /** Eligible adults in this plan (mom + adult members), display names resolved. */
  members: Array<{ id: string; name: string }>;
  checkins: Mark[];
  verdicts: VerdictMark[];
  /** Workout session marks (the exercise pillar); empty when no workout plan. */
  workoutCheckins?: WorkoutMark[];
  /** Adults who reached their target weight — the achievement ONLY (no number,
   * no target); pregnant/lactating are never here (filtered on the server). */
  goalReached?: Array<{ id: string; name: string }>;
  /** Plan week start (YYYY-MM-DD) → real weekday initials on the strip. */
  weekStartDate?: string;
}) {
  const memberIds = new Set(members.map((m) => m.id));

  // Meal-true family total: (day, slot) is the meal's identity, so a shared
  // dinner marked by three people is ONE followed meal (household size can never
  // inflate it — mirrors the engagement digest).
  const mealKey = (c: Mark) => `${c.day_index}|${c.slot}`;
  const followedMeals = new Set(checkins.map(mealKey)).size;
  const mealsHappened = new Set(
    checkins.filter((c) => c.status !== "skipped").map(mealKey),
  ).size;
  const mealDays = new Set(checkins.map((c) => c.day_index));
  const activeDays = mealDays.size; // strip is meal-anchored
  const honored = activeDays >= HONOR_DAYS_GOAL;
  const workoutActs = new Set(
    workoutCheckins
      .filter((w) => w.member_id && memberIds.has(w.member_id) && w.day_index != null)
      .map((w) => `${w.day_index}|${w.member_id}`),
  ).size;
  const sessionsDone = workoutCheckins.filter(
    (w) => w.status === "done" || w.status === "moved",
  ).length;
  const fillFrac = Math.min(1, CAP > 0 ? (followedMeals + workoutActs) / CAP : 0);

  // Distinct meal slots per plan-day → the day's star rating (max 3).
  const slotsPerDay = new Map<number, Set<string>>();
  for (const c of checkins) {
    if (!slotsPerDay.has(c.day_index)) slotsPerDay.set(c.day_index, new Set());
    slotsPerDay.get(c.day_index)!.add(c.slot);
  }

  // Per-member participation (meal marks + verdicts + workout marks) → rank + %.
  const acts: Record<string, number> = {};
  members.forEach((m) => (acts[m.id] = 0));
  const bump = (id: string | null | undefined) => {
    if (id && memberIds.has(id)) acts[id] = (acts[id] ?? 0) + 1;
  };
  for (const c of checkins) bump(c.member_id);
  for (const v of verdicts) bump(v.member_id);
  for (const w of workoutCheckins) bump(w.member_id);

  const ranked = members
    .map((m) => ({
      ...m,
      score: acts[m.id] ?? 0,
      pct: Math.min(1, (acts[m.id] ?? 0) / WEEKLY_TARGET),
    }))
    .sort((a, b) => b.score - a.score);
  const maxScore = ranked[0]?.score ?? 0;
  const hasWinner = maxScore > 0;
  const leaderName = hasWinner && ranked[0] ? ranked[0].name : null;

  const hasActivity = followedMeals > 0 || workoutActs > 0;

  return (
    <div className="space-y-5">
      {/* ── Top card: the shared season header ─────────────────────────── */}
      <section
        aria-labelledby="family-season-heading"
        className="rounded-3xl border border-brand-purple-900/10 bg-[linear-gradient(160deg,#F5F0FC,#EFE9F8)] p-4 sm:p-6 shadow-[0_1px_0_#fff_inset,0_18px_40px_-26px_rgba(78,36,144,0.35)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid place-items-center size-11 shrink-0 rounded-full bg-brand-purple-900 text-brand-yellow"
            >
              <Trophy className="size-[22px]" />
            </span>
            <h2
              id="family-season-heading"
              className="font-extrabold text-brand-ink text-lg sm:text-2xl leading-tight"
            >
              موسم بيتنا
            </h2>
          </div>
          {honored && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1.5 text-xs font-extrabold text-brand-ink">
              <Crown className="size-3.5" aria-hidden="true" />
              أتممتم موسمكم
            </span>
          )}
        </div>

        {hasActivity ? (
          <>
            <div className="flex items-center justify-start gap-4 sm:gap-7 mt-4">
              <div className="relative shrink-0 size-24 sm:size-28">
                <Ring frac={fillFrac} color="var(--color-brand-purple-900)" track="rgba(217,176,252,0.5)" sw={8} r={44} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-purple-900 leading-none">
                    <Figure n={followedMeals} />
                  </span>
                  <span className="text-[11px] text-brand-ink-muted mt-0.5">وجبات معاً</span>
                </div>
              </div>
              <div className="min-w-0 text-start">
                <p className="text-[15px] sm:text-lg leading-relaxed text-brand-ink">
                  هذا الأسبوع اجتمع بيتكم على{" "}
                  <Count n={mealsHappened} one="وجبة واحدة" two="وجبتين" few="وجبات" many="وجبة" />{" "}
                  معاً
                  <span className="block text-brand-ink-muted text-[13px] mt-1">
                    أضاء <Count n={activeDays} one="يوماً واحداً" two="يومين" few="أيام" many="يوماً" />
                    {sessionsDone > 0 && (
                      <>
                        ، ومعها{" "}
                        <Count n={sessionsDone} one="حصة حركة" two="حصتَي حركة" few="حصص حركة" many="حصة حركة" />
                      </>
                    )}
                    .
                  </span>
                </p>
                {leaderName && (
                  <span className="inline-flex items-center gap-2 mt-3 rounded-full bg-brand-lavender/40 px-3.5 py-2 text-[13px] sm:text-sm font-extrabold text-brand-purple-700">
                    <Crown className="size-4 text-brand-yellow" aria-hidden="true" />
                    الأكثر مواظبة هذا الأسبوع: {leaderName}
                  </span>
                )}
              </div>
            </div>

            {/* 7-day meal strip — earliest day on the RIGHT (RTL-native). A day
                the house cooked lights up with its star rating + a utensils
                mark; a day without a meal mark is a dashed placeholder. */}
            <ul className="grid grid-cols-7 gap-1.5 sm:gap-3 mt-5 list-none p-0 m-0" aria-label="أيام الأسبوع">
              {Array.from({ length: 7 }, (_, i) => {
                const cooked = mealDays.has(i);
                const stars = Math.min(3, slotsPerDay.get(i)?.size ?? 0);
                const label = weekdayInitial(weekStartDate, i);
                return (
                  <li key={i} className="flex flex-col items-center gap-2">
                    <div
                      role="img"
                      aria-label={`${label}: ${cooked ? "طُبخ من الخطة" : "بلا تسجيل"}`}
                      className={
                        "w-full aspect-[1/0.92] rounded-2xl flex flex-col items-center justify-center gap-1.5 " +
                        (cooked
                          ? "bg-[linear-gradient(160deg,#6A38B0,#4E2490_60%,#3D1C73)] shadow-[0_10px_22px_-12px_rgba(78,36,144,0.7)]"
                          : "bg-white/50 border-[1.5px] border-dashed border-brand-purple-900/20")
                      }
                    >
                      {cooked && (
                        <>
                          <span className="flex gap-0.5">
                            {[0, 1, 2].map((s) => (
                              <StarIcon key={s} filled={s < stars} />
                            ))}
                          </span>
                          <UtensilsMark />
                        </>
                      )}
                    </div>
                    <span aria-hidden="true" className="text-xs sm:text-[15px] font-extrabold text-brand-ink">
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-brand-ink text-sm leading-relaxed mt-4">
            موسم بيتكم يبدأ بأول تسجيل — سجّلوا وجباتكم وتمارينكم من الخطة، وتبدأ
            لوحة الصدارة هنا.
          </p>
        )}
      </section>

      {/* ── Leaderboard: eligible adults ranked by weekly participation ─── */}
      <ul className="grid gap-3.5 sm:gap-5 grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] list-none p-0 m-0">
        {ranked.map((m, idx) => {
          const rank = idx + 1;
          const isWinner = hasWinner && idx === 0;
          const pctText = (
            <span dir="ltr" className="tabular-nums">
              {pctFmt.format(m.pct)}
            </span>
          );
          if (isWinner) {
            return (
              <li
                key={m.id}
                className="relative rounded-3xl p-4 sm:p-5 mt-5 flex flex-col gap-3.5 text-brand-ink bg-[linear-gradient(150deg,#FFE08A,#F2BB16_45%,#E4A50E)] shadow-[0_18px_40px_-14px_rgba(242,187,22,0.65)]"
                aria-label={`المركز الأول: ${m.name}`}
              >
                <WinnerCrown />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-4xl sm:text-5xl font-extrabold leading-none text-[#8A5A00]" dir="ltr">
                    #{ar(rank)}
                  </span>
                  <div className="flex-1 text-center min-w-0">
                    <p className="text-base sm:text-xl font-extrabold text-brand-ink truncate">{m.name}</p>
                    <p className="text-xs text-[#6B4E06]">حاضرة</p>
                  </div>
                  <div className="relative shrink-0 size-[72px] sm:size-[88px]">
                    <Ring frac={m.pct} color="#7A5200" track="rgba(107,78,6,0.22)" sw={7} r={34} />
                    <span className="absolute inset-0 grid place-items-center text-base sm:text-lg font-extrabold text-brand-ink">
                      {pctText}
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-[#6B4E06]/15 px-4 py-2 text-[13px] sm:text-sm font-extrabold text-[#6B4E06]">
                  <Crown className="size-4" aria-hidden="true" />
                  فائز هذا الأسبوع
                </span>
              </li>
            );
          }
          return (
            <li
              key={m.id}
              className="rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3.5 bg-brand-purple-900 text-white min-h-[120px]"
              aria-label={`المركز ${ar(rank)}: ${m.name}`}
            >
              <span className="text-4xl sm:text-5xl font-extrabold leading-none text-brand-lavender" dir="ltr">
                #{ar(rank)}
              </span>
              <div className="flex-1 text-center min-w-0">
                <p className="text-base sm:text-xl font-extrabold truncate">{m.name}</p>
                <p className="text-xs text-brand-lavender">
                  {m.score > 0 ? "حاضرة" : "بانتظار البداية"}
                </p>
              </div>
              <div className="relative shrink-0 size-[72px] sm:size-[88px]">
                <Ring frac={m.pct} color="var(--color-brand-lavender)" track="rgba(255,255,255,0.22)" sw={7} r={34} />
                <span className="absolute inset-0 grid place-items-center text-base sm:text-lg font-extrabold text-white">
                  {pctText}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Goal achievements (kept as an achievement event only — no numbers). */}
      {goalReached.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {goalReached.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-yellow/20 border border-brand-yellow/50 px-3 py-2 text-[12.5px] font-bold text-brand-ink"
            >
              <Crown className="size-3.5 shrink-0 text-brand-purple-900" aria-hidden="true" />
              تحقّق الهدف — مبارك {g.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
