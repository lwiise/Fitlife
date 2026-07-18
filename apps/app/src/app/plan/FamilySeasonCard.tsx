import { Trophy, Crown } from "lucide-react";

// «موسم بيتنا» — the cooperative family season (Phase 1 of the engagement plan,
// Option A). The owner's brief asked for a family "leaderboard"; the research
// (Gulf collective-privacy, the eating-disorder harm literature, and our own
// §6 guardrails) says a public per-member adherence RANKING is the wrong shape
// for this audience. So this keeps the competitive ENERGY — a shared goal, a
// celebrated leader, momentum — while staying cooperative:
//   • the headline is a FAMILY total (meals the house followed), never a
//     per-member score board;
//   • counts are MEAL-TRUE (distinct day+slot), so household size can never
//     inflate the number (mirrors the digest's collapsing rule);
//   • the most-consistent adult is CELEBRATED (upward aspiration), but no one
//     is ranked last, nothing is red, and a member with no marks yet reads as
//     invited, not behind — no designed shame state (guardrail 5);
//   • built only from what was actually logged (unanswered = unknown, never a
//     zero that counts against anyone).
// Adults only (children are never compared; the housekeeper is never
// surveilled); the caller hides it for solo households and read-only/translated
// views.

const HONOR_DAYS_GOAL = 5; // days logged in a week to "honor" the season — a
// gentle absolute bar (the sanctioned cohort-season shape), not a target to
// miss: the ring only fills, it never shames.

const ar = (n: number) =>
  new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);

type Mark = { day_index: number; slot: string; member_id?: string | null };
type VerdictMark = { member_id?: string | null };

export function FamilySeasonCard({
  members,
  checkins,
  verdicts,
}: {
  /** Eligible adults in this plan (mom + adult members), display names resolved. */
  members: Array<{ id: string; name: string }>;
  checkins: Mark[];
  verdicts: VerdictMark[];
}) {
  // Meal-true family headline: distinct (day, slot) the house engaged with —
  // a shared meal marked by three people is ONE followed meal, never three.
  const followedMeals = new Set(
    checkins.map((c) => `${c.day_index}|${c.slot}`),
  ).size;
  // Days the house logged anything — the "honor the week" progress.
  const activeDays = new Set(checkins.map((c) => c.day_index)).size;
  const honored = activeDays >= HONOR_DAYS_GOAL;
  const ringPct = Math.min(1, activeDays / HONOR_DAYS_GOAL);

  // Per-adult engagement = their own marks + verdicts (personal rows only;
  // whole-house rows aren't attributable to a person, children/housekeeper are
  // not in `members` so they're excluded by construction).
  const contribution = (id: string) =>
    checkins.filter((c) => c.member_id === id).length +
    verdicts.filter((v) => v.member_id === id).length;
  const scored = members
    .map((m) => ({ ...m, score: contribution(m.id) }))
    .sort((a, b) => b.score - a.score);
  const leader = scored[0]?.score ? scored[0] : null;

  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <section
      aria-labelledby="family-season-heading"
      className="bg-white rounded-2xl border border-brand-ink/5 p-4 sm:p-5 space-y-4"
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
            <p className="text-brand-ink-muted text-xs">معاً هذا الأسبوع</p>
          </div>
        </div>
        {honored && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-yellow px-3 py-1 text-xs font-extrabold text-brand-ink">
            أتممتم موسمكم
          </span>
        )}
      </div>

      {followedMeals === 0 ? (
        // No marks yet — invite, never accuse (guardrail 7 spirit).
        <p className="text-brand-ink text-sm leading-relaxed">
          موسمكم يبدأ بأول تسجيل — سجّلوا وجباتكم من الخطة، ويظهر تقدّم بيتكم هنا.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <svg
                width="56"
                height="56"
                viewBox="0 0 56 56"
                role="img"
                aria-label={`سجّلتم في ${ar(activeDays)} من ${ar(HONOR_DAYS_GOAL)} أيام`}
              >
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  stroke="var(--color-brand-lavender)"
                  strokeWidth="6"
                  opacity="0.4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  stroke="var(--color-brand-purple-900)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - ringPct)}
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-xs font-extrabold text-brand-purple-900 tabular-nums">
                {ar(activeDays)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold text-brand-ink tabular-nums leading-none">
                {ar(followedMeals)}
              </p>
              <p className="text-brand-ink-muted text-xs mt-1 leading-relaxed">
                وجبة تابعها بيتكم معاً هذا الأسبوع
              </p>
            </div>
          </div>

          {leader && (
            <p className="flex items-center gap-1.5 text-sm text-brand-ink">
              <Crown
                className="size-4 shrink-0 text-brand-yellow"
                aria-hidden="true"
              />
              <span>
                الأكثر مواظبة:{" "}
                <span className="font-extrabold text-brand-purple-900">
                  {leader.name}
                </span>
              </span>
            </p>
          )}

          <ul className="flex flex-wrap gap-2">
            {scored.map((m) => {
              const isLeader = leader?.id === m.id;
              return (
                <li
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    isLeader
                      ? "bg-brand-lavender/40 text-brand-purple-900"
                      : "bg-brand-surface text-brand-ink"
                  }`}
                >
                  {isLeader && (
                    <Crown
                      className="size-3.5 text-brand-yellow"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate max-w-[8rem]">{m.name}</span>
                  {m.score > 0 ? (
                    <span className="tabular-nums text-brand-ink-muted">
                      {ar(m.score)}
                    </span>
                  ) : (
                    <span className="text-brand-ink-muted">بانتظار البداية</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
