/**
 * «٥ وجبات ويسبق هند» — how many more meals cooked as written would move a
 * member past the person ranked directly above them, holding everyone else
 * still. Uses the owner formula computeSeasonStats ranks by: meals-only
 * members are m/M; members with a workout pillar are (m/M + s/S) / 2.
 *
 * Conservative on purpose: it asks for a STRICTLY higher percentage, so a line
 * never promises an overtake that the roster-order tie-break would deny.
 * Returns null when no number of the remaining planned meals is enough.
 */

export interface GapMember {
  pct: number;
  mealsMarked: number;
  mealsPlanned: number;
  sessionsMarked?: number;
  sessionsPlanned?: number;
}

export function mealsToPass(member: GapMember, above: GapMember): number | null {
  const M = member.mealsPlanned;
  if (M <= 0) return null;
  const S = member.sessionsPlanned;
  const sessFrac =
    S !== undefined && S > 0 ? Math.min(member.sessionsMarked ?? 0, S) / S : 0;
  const pctWith = (meals: number) => {
    const mealFrac = Math.min(meals, M) / M;
    return S === undefined ? mealFrac : (mealFrac + sessFrac) / 2;
  };
  const start = Math.min(member.mealsMarked, M);
  for (let k = 1; start + k <= M; k++) {
    if (pctWith(start + k) > above.pct + 1e-9) return k;
  }
  return null;
}
