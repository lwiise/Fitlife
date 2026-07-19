import { Trophy, Crown, Sparkles, Heart } from "lucide-react";

// «موسم بيتنا» — the cooperative family season, redesigned as «بيتنا يُضيء»
// (Phase 1, Option A). The owner's brief asked for a family "leaderboard"; the
// research (Gulf collective-privacy, the eating-disorder harm literature, our
// §6 guardrails) says a public per-member adherence RANKING is the wrong shape.
// So there is ONE shared object the whole house fills together — a ring whose
// member-colored segments encircle a home whose windows warm as the week fills:
//   • the headline is a FAMILY total (meals the house followed), never a
//     per-member score board; counts are MEAL-TRUE (distinct day+slot), so
//     household size can never inflate them (mirrors the digest's collapse);
//   • each adult is a colored segment of the ONE object AND an identical
//     self-referential mini-ring — visible, never ranked, never a raw integer
//     chip (the old chip row read as a soft leaderboard);
//   • the object only ever FILLS — a quiet week is a smaller, still-warm home,
//     never red, never a shortfall arc, never a missable target (the invisible
//     capacity is felt, not stated);
//   • the most-consistent adult is CELEBRATED (upward aspiration), but no one is
//     ranked last, and a member with no marks yet reads as INVITED, not behind;
//   • built only from what was actually logged (unanswered = unknown, never a
//     zero that counts against anyone).
// Both pillars feed it: meal check-ins/verdicts and workout session marks.
// Adults only (children are never compared; the housekeeper is never
// surveilled); the caller hides it for solo households and read-only/translated
// views.

const HONOR_DAYS_GOAL = 5; // days logged in a week to "honor" the season — a
// gentle absolute bar (the sanctioned cohort-season shape), NOT a target to
// miss: it only celebrates when reached, and its absence is never a shortfall.
const CAP = 14; // invisible soft capacity the family fills toward (~a couple of
// honest marks a day). NEVER rendered as "X of Y" or "N remaining" — only the
// fill level appears, so the goal is felt (the ring wants to close), not stated.

// Member segment colours (fill only; identity is always ALSO carried by the
// labelled mini-ring below, so meaning is never colour-alone). mom = purple.
const SEGMENT_COLORS = [
  "var(--color-brand-purple-900)",
  "var(--color-brand-pink)",
  "var(--color-brand-lavender)",
  "var(--color-brand-yellow)",
  "var(--color-brand-purple-700)",
];
// A meal marked only via the "household" sentinel (no per-person row) is the
// whole house, not any individual — a distinct desaturated band, never
// fabricated individual credit.
const HOUSE_BAND = "#B8AEC6";

const WEEKDAY_INITIALS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // getUTCDay 0=Sun

const ar = (n: number) =>
  new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);

function weekdayInitial(weekStartDate: string | undefined, dayIndex: number) {
  if (!weekStartDate) return ar(dayIndex + 1);
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ar(dayIndex + 1);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return WEEKDAY_INITIALS[d.getUTCDay()] ?? "";
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
  if (n === 1)
    return <strong className="font-extrabold text-brand-purple-900">{one}</strong>;
  if (n === 2)
    return <strong className="font-extrabold text-brand-purple-900">{two}</strong>;
  return (
    <>
      <strong className="font-extrabold text-brand-purple-900">
        <Figure n={n} />
      </strong>{" "}
      {n <= 10 ? few : many}
    </>
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
  /** Plan week start (YYYY-MM-DD) → real weekday initials on the strip. Falls
   * back to day numbers when absent. */
  weekStartDate?: string;
}) {
  const memberIds = new Set(members.map((m) => m.id));

  // Collapse per-person rows to MEALS: (day, slot) is the meal's identity, so a
  // shared dinner marked by three people is ONE followed meal — household size
  // can never inflate the headline (mirrors the engagement digest).
  const mealMarkers = new Map<string, Set<string>>();
  for (const c of checkins) {
    const key = `${c.day_index}|${c.slot}`;
    if (!mealMarkers.has(key)) mealMarkers.set(key, new Set());
    const mid = c.member_id;
    if (mid && mid !== "household" && memberIds.has(mid))
      mealMarkers.get(key)!.add(mid);
  }
  const followedMeals = mealMarkers.size; // meal-true family headline
  // Meals that actually happened (cooked/swapped) — honest skips still light the
  // strip and feed the fill, but are never spoken as cooked meals.
  const mealsHappened = new Set(
    checkins
      .filter((c) => c.status !== "skipped")
      .map((c) => `${c.day_index}|${c.slot}`),
  ).size;
  // Days the house engaged. Meal check-ins carry a PLAN-relative day_index;
  // workout check-ins carry a WEEKDAY-anchored one (0=Sun). We never co-place
  // raw indices — with weekStartDate we map each plan day to its weekday, then
  // light the plan day whose weekday a workout falls on. Without it, the strip
  // stays meal-anchored (workout activity still shows in the ring + mini-rings).
  const weekdayToPlanIndex = new Map<number, number>();
  if (weekStartDate) {
    const base = new Date(`${weekStartDate}T00:00:00Z`);
    if (!Number.isNaN(base.getTime())) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() + i);
        weekdayToPlanIndex.set(d.getUTCDay(), i);
      }
    }
  }
  const mealDays = new Set(checkins.map((c) => c.day_index)); // a meal was marked
  const litDays = new Set(mealDays); // any engagement (meal or movement)
  if (weekdayToPlanIndex.size > 0) {
    for (const w of workoutCheckins) {
      if (w.day_index == null) continue;
      const pi = weekdayToPlanIndex.get(w.day_index);
      if (pi != null) litDays.add(pi);
    }
  }
  const activeDays = litDays.size;
  const honored = activeDays >= HONOR_DAYS_GOAL;

  // Workout acts are inherently per-member; distinct (day, member).
  const workoutKeys = new Set<string>();
  for (const w of workoutCheckins) {
    if (w.member_id && memberIds.has(w.member_id) && w.day_index != null)
      workoutKeys.add(`${w.day_index}|${w.member_id}`);
  }
  const workoutActs = workoutKeys.size;
  const sessionsDone = workoutCheckins.filter(
    (w) => w.status === "done" || w.status === "moved",
  ).length;

  const houseTotal = followedMeals + workoutActs;
  const fillFrac = Math.min(1, CAP > 0 ? houseTotal / CAP : 0);

  // Member segment lengths: each distinct meal = 1 unit split equally among the
  // per-person rows that marked it; a household-sentinel-only meal → the neutral
  // house band. Each workout act = 1 unit to that member. Σ = houseTotal, so the
  // stack stays meal-true (no double-count, no household inflation).
  const memberLen: Record<string, number> = {};
  members.forEach((m) => (memberLen[m.id] = 0));
  let houseBand = 0;
  for (const set of mealMarkers.values()) {
    const ms = [...set];
    if (ms.length === 0) houseBand += 1;
    else ms.forEach((id) => (memberLen[id] = (memberLen[id] ?? 0) + 1 / ms.length));
  }
  for (const key of workoutKeys) {
    const id = key.split("|")[1]!;
    memberLen[id] = (memberLen[id] ?? 0) + 1;
  }

  // Per-adult "acts" (personal rows only) → self-referential mini-ring + the
  // single upward spotlight. Children/housekeeper are not in `members`, so they
  // are excluded by construction.
  const acts: Record<string, number> = {};
  members.forEach((m) => (acts[m.id] = 0));
  const bump = (id: string | null | undefined) => {
    if (id && memberIds.has(id)) acts[id] = (acts[id] ?? 0) + 1;
  };
  for (const c of checkins) bump(c.member_id);
  for (const v of verdicts) bump(v.member_id);
  for (const w of workoutCheckins) bump(w.member_id);

  const totalActs = Object.values(acts).reduce((a, b) => a + b, 0);
  const maxActs = Math.max(0, ...Object.values(acts));
  const leaders = members.filter((m) => acts[m.id] === maxActs && maxActs > 0);
  // A single clear leader is celebrated; below the noise floor, or on a tie, the
  // house is honoured collectively — never a designated last place.
  const leaderMsg =
    totalActs < 3
      ? "بيتكم كله حاضر"
      : leaders.length === 1
        ? `الأكثر مواظبة هذا الأسبوع: ${leaders[0]!.name}`
        : "تناوبتم على العناية ببيتكم";
  const leaderNamed = totalActs >= 3 && leaders.length === 1;

  // Verdict sentiment as feeling, never a count. not_again is never shown as negative.
  const lovedCount = verdicts.filter((v) => v.verdict === "loved").length;
  const verdictMsg =
    lovedCount >= 2
      ? "ونالت مائدتكم الكثير من الحب هذا الأسبوع"
      : lovedCount === 1
        ? "وكان لبعض الأطباق مكانٌ خاص هذا الأسبوع"
        : null;

  const hasActivity = houseTotal > 0;

  // ─ Ring geometry ─────────────────────────────────────────────────────────
  const cx = 66,
    cy = 66,
    R = 54,
    SW = 11;
  const C = 2 * Math.PI * R;
  type Seg = { color: string; len: number; offset: number };
  const segs: Seg[] = [];
  let cum = 0;
  members.forEach((m, i) => {
    const frac = memberLen[m.id]! / CAP;
    if (frac > 0.0008) {
      segs.push({ color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]!, len: frac, offset: cum });
      cum += frac;
    }
  });
  if (houseBand > 0.0008) {
    segs.push({ color: HOUSE_BAND, len: houseBand / CAP, offset: cum });
    cum += houseBand / CAP;
  }
  const tipAngle = fillFrac * 2 * Math.PI;
  const tipX = cx + R * Math.sin(tipAngle);
  const tipY = cy - R * Math.cos(tipAngle);
  const tipColor = segs.length ? segs[segs.length - 1]!.color : "var(--color-brand-purple-900)";

  const ringAria = hasActivity
    ? `بيتكم أضاء ${ar(activeDays)} من أيامه هذا الأسبوع، واجتمعتم على ${ar(mealsHappened)} وجبات${
        sessionsDone ? ` و${ar(sessionsDone)} حصص حركة` : ""
      }`
    : "موسم بيتكم لم يبدأ بعد";

  // Home windows warm at rising fill thresholds; the home is never fully dark
  // (a pilot glow) so absence reads as waiting, never failure.
  const winFill = (t: number) =>
    fillFrac >= t ? "var(--color-brand-yellow)" : "var(--color-brand-surface)";
  const winStroke = (t: number) =>
    fillFrac >= t ? "var(--color-brand-yellow)" : "rgba(26,16,35,0.12)";
  const glowOpacity = fillFrac > 0.02 ? 0.22 + 0.55 * fillFrac : 0.1;

  const ringSvg = (
    <svg viewBox="0 0 132 132" className="w-full h-full" role="img" aria-label={ringAria}>
      <defs>
        <radialGradient id="fs-home-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-brand-yellow)" />
          <stop offset="55%" stopColor="var(--color-brand-lavender)" />
          <stop offset="100%" stopColor="var(--color-brand-lavender)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* track — dashed lavender = invitation; never red, never a shortfall arc */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke="var(--color-brand-lavender)"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeDasharray="2 7"
        opacity={0.4}
      />
      {segs.map((s, i) => {
        const len = s.len * C;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
            strokeDashoffset={(-s.offset * C).toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      {fillFrac > 0.01 && (
        <circle cx={tipX.toFixed(2)} cy={tipY.toFixed(2)} r={SW / 2} fill={tipColor} />
      )}
      {/* home glyph */}
      <circle cx={cx} cy={cy + 2} r={26} fill="url(#fs-home-glow)" opacity={glowOpacity} />
      <g stroke="var(--color-brand-ink)" strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <path d={`M${cx - 16} ${cy - 1} L${cx} ${cy - 16} L${cx + 16} ${cy - 1}`} />
        <path
          d={`M${cx - 13} ${cy - 2} L${cx - 13} ${cy + 15} L${cx + 13} ${cy + 15} L${cx + 13} ${cy - 2}`}
        />
      </g>
      <rect x={cx - 9} y={cy + 1} width={7} height={6} rx={1.4} fill={winFill(0.25)} stroke={winStroke(0.25)} strokeWidth={1} />
      <rect x={cx + 2} y={cy + 1} width={7} height={6} rx={1.4} fill={winFill(0.55)} stroke={winStroke(0.55)} strokeWidth={1} />
      <rect x={cx - 4} y={cy + 8} width={8} height={7} rx={1.4} fill={winFill(0.78)} stroke={winStroke(0.78)} strokeWidth={1} />
      {honored && (
        <path
          d={`M${cx} ${cy - 24} l1.6 3.4 3.7.5 -2.7 2.6 .7 3.7 -3.3 -1.8 -3.3 1.8 .7 -3.7 -2.7 -2.6 3.7 -.5 z`}
          fill="var(--color-brand-yellow)"
        />
      )}
    </svg>
  );

  return (
    <section
      aria-labelledby="family-season-heading"
      className="bg-gradient-to-b from-brand-lavender/10 to-brand-lavender/20 rounded-2xl border border-brand-purple-900/10 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid place-items-center size-9 shrink-0 rounded-full bg-brand-purple-900 text-brand-yellow"
          >
            <Trophy className="size-[18px]" />
          </span>
          <div>
            <h2
              id="family-season-heading"
              className="font-extrabold text-brand-ink text-base leading-tight"
            >
              موسم بيتنا
            </h2>
            <p className="text-brand-ink-muted text-xs">أسبوعكم معاً</p>
          </div>
        </div>
        {honored && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1 text-xs font-extrabold text-brand-ink">
            <Sparkles className="size-3.5" aria-hidden="true" />
            أتممتم موسمكم
          </span>
        )}
      </div>

      {!hasActivity ? (
        // First-time: the home is present and softly lit, waiting — never dark,
        // never a scoreboard at zero (guardrail 5/7).
        <>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 size-28">{ringSvg}</div>
            <p className="text-brand-ink text-sm leading-relaxed min-w-0">
              موسم بيتكم يبدأ بأول لمسة —{" "}
              <span className="font-bold text-brand-purple-900">
                علّموا وجباتكم وتمارينكم
              </span>{" "}
              من الخطة، ويبدأ الضوء يملأ البيت.
            </p>
          </div>
          <WeekStrip weekStartDate={weekStartDate} litDays={litDays} mealDays={mealDays} />
          <Roster members={members} acts={acts} />
        </>
      ) : (
        <>
          {/* HERO — one home the whole house fills together */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 size-28">{ringSvg}</div>
            <div className="min-w-0">
              <p className="text-brand-ink text-base leading-relaxed">
                هذا الأسبوع اجتمع بيتكم على{" "}
                <Count n={mealsHappened} one="وجبة واحدة" two="وجبتين" few="وجبات" many="وجبة" />{" "}
                معاً
                <span className="block text-brand-ink-muted text-xs mt-1 leading-relaxed">
                  أضاء <Count n={activeDays} one="يوماً واحداً" two="يومين" few="أيام" many="يوماً" />
                  {sessionsDone > 0 && (
                    <>
                      ، ومعها{" "}
                      <Count n={sessionsDone} one="حصة حركة واحدة" two="حصتَي حركة" few="حصص حركة" many="حصة حركة" />
                    </>
                  )}
                  .
                </span>
              </p>
              <p className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-brand-lavender/35 px-3 py-1.5 text-[13px] font-bold text-brand-purple-700">
                {leaderNamed ? (
                  <Crown className="size-3.5 text-brand-yellow" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-3.5 text-brand-yellow" aria-hidden="true" />
                )}
                {leaderMsg}
              </p>
            </div>
          </div>

          <WeekStrip weekStartDate={weekStartDate} litDays={litDays} mealDays={mealDays} />

          <Roster members={members} acts={acts} />

          {(verdictMsg || goalReached.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {verdictMsg && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-lavender/25 px-3 py-2 text-[12.5px] text-brand-ink leading-relaxed">
                  <Heart className="size-3.5 shrink-0 text-brand-pink" aria-hidden="true" />
                  {verdictMsg}
                </span>
              )}
              {goalReached.map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-yellow/20 border border-brand-yellow/50 px-3 py-2 text-[12.5px] font-bold text-brand-ink"
                >
                  <Sparkles className="size-3.5 shrink-0 text-brand-purple-900" aria-hidden="true" />
                  تحقّق الهدف — مبارك {g.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** The 7-day week strip — earliest day on the RIGHT (RTL-native), a cell lit for
 * every day the house engaged; unlit days are neutral surface (quiet, not
 * behind). Meal days carry a small warm dot. */
function WeekStrip({
  weekStartDate,
  litDays,
  mealDays,
}: {
  weekStartDate?: string;
  litDays: Set<number>;
  mealDays: Set<number>;
}) {
  return (
    <ul className="flex gap-1.5 list-none p-0 m-0" aria-label="أيام الأسبوع">
      {Array.from({ length: 7 }, (_, i) => {
        const lit = litDays.has(i);
        const dayName = weekStartDate
          ? `${weekdayInitial(weekStartDate, i)}`
          : `${ar(i + 1)}`;
        return (
          <li key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <span
              className={
                "w-full aspect-square max-h-[34px] rounded-lg grid place-items-center " +
                (lit
                  ? "bg-gradient-to-b from-brand-lavender to-brand-purple-900"
                  : "bg-brand-surface border border-dashed border-brand-ink/15")
              }
              role="img"
              aria-label={`${dayName}: ${lit ? "نشِط" : "بانتظار"}`}
            >
              {lit && mealDays.has(i) && (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-yellow" />
              )}
            </span>
            <span aria-hidden="true" className="text-[11px] font-semibold text-brand-ink-muted">
              {dayName}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Per-adult mini-rings — identical, self-referential to each member's own week,
 * in STABLE order (never sorted by contribution). No integer is shown. A member
 * with no marks is a ghost ring, «بانتظار لمستكِ», at equal weight — invited,
 * never last. Replaces the old ranked name+count chip row. */
function Roster({
  members,
  acts,
}: {
  members: Array<{ id: string; name: string }>;
  acts: Record<string, number>;
}) {
  const cx = 26,
    cy = 26,
    r = 21,
    sw = 5;
  const C = 2 * Math.PI * r;
  return (
    <ul className="flex gap-3.5 overflow-x-auto pb-1 list-none p-0 m-0">
      {members.map((m, i) => {
        const a = acts[m.id] ?? 0;
        const ghost = a === 0;
        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
        const len = Math.min(1, a / 7) * C;
        return (
          <li key={m.id} className="flex-none w-[60px] text-center">
            <div
              className="size-[52px] mx-auto"
              role="img"
              aria-label={`${m.name}: ${ghost ? "بانتظار أول لمسة" : "حاضرة هذا الأسبوع"}`}
            >
              <svg viewBox="0 0 52 52" className="w-full h-full">
                {ghost ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="var(--color-brand-lavender)"
                    strokeWidth={sw}
                    strokeDasharray="3 5"
                    opacity={0.7}
                  />
                ) : (
                  <>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-brand-surface)" strokeWidth={sw} />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
                      transform={`rotate(-90 ${cx} ${cy})`}
                    />
                  </>
                )}
              </svg>
            </div>
            <p className="text-xs font-bold text-brand-ink mt-1.5 truncate">{m.name}</p>
            <p className="text-[10px] text-brand-ink-muted">
              {ghost ? "بانتظار لمستكِ" : "حاضرة"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
