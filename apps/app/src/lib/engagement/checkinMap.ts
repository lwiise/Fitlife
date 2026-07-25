/**
 * The ONE definition of how a meal's mark is read from — and cleared out of —
 * the /plan optimistic map, so the two can never disagree.
 *
 * A meal's chip is lit by the FIRST row that answers for it: the member's own
 * row (on a shared dish, any sharer's — the fan-out keeps them in agreement),
 * else the whole-house row ('household': legacy pre-00019 data, ختام اليوم).
 * That fallback is why clearing has to sweep more than the member's own key:
 * leaving the whole-house row behind re-lights the chip the user just
 * un-tapped, with whatever the kitchen last attested — usually an old
 * «تجاوزتها». An explicit un-tap means «this meal carries no mark», so the
 * clear removes every key that could answer for it (owner report 07/2026).
 *
 * The server mirrors this exactly in engagement/actions.ts.
 */

import { HOUSEHOLD_CHECKIN_MEMBER, type CheckinStatus } from "./types";

export type CheckinMark = { status: CheckinStatus; reason: string | null };

/** Optimistic-map key: one mark per (plan day, slot, member). */
export function checkinMapKey(
  dayIndex: number,
  slot: string,
  memberId: string,
): string {
  return `${dayIndex}|${slot}|${memberId}`;
}

/**
 * The mark that answers for this meal. `memberIds` is the lookup order: one id
 * for an individual meal, the sharers PRESENT-FIRST for a shared dish (so a
 * stale row on an absentee never outranks a present sharer's mark). Falls back
 * to the whole-house row, which speaks for every member of the meal.
 */
export function resolveCheckin(
  map: ReadonlyMap<string, CheckinMark>,
  dayIndex: number,
  slot: string,
  memberIds: readonly string[],
): CheckinMark | null {
  for (const id of memberIds) {
    const own = map.get(checkinMapKey(dayIndex, slot, id));
    if (own) return own;
  }
  return map.get(checkinMapKey(dayIndex, slot, HOUSEHOLD_CHECKIN_MEMBER)) ?? null;
}

/**
 * The member's OWN mark, with NO whole-house fallback — for a member who is
 * out of a shared meal occurrence (00021). The kitchen's attestation covers
 * the dish they were excluded from, so it must never answer for them: their
 * tab would otherwise read «طُبخت» for a meal they had no part in. Their mark
 * is personal («بدّلتها»/«تجاوزتها»), and unanswered stays unknown.
 */
export function ownCheckin(
  map: ReadonlyMap<string, CheckinMark>,
  dayIndex: number,
  slot: string,
  memberId: string,
): CheckinMark | null {
  return map.get(checkinMapKey(dayIndex, slot, memberId)) ?? null;
}

/**
 * Every key a clear must remove for the meal to actually read as unmarked:
 * the members' own rows PLUS the whole-house fallback. Anything less leaves a
 * row that resolveCheckin would still surface, and the un-tap looks ignored.
 *
 * `sweepHousehold: false` is the out-of-meal case, and it mirrors ownCheckin:
 * an excluded member's chip is read without the fallback, so clearing it needs
 * no sweep — and must not have one, or one un-tap on the tab of someone who
 * sat the meal out would retract the kitchen's attestation for the dish the
 * others shared. The server decides which of the two it is (see setMealCheckin
 * in engagement/actions.ts) — a tab opened before the absence landed still
 * thinks that member is a sharer.
 */
export function checkinClearKeys(
  dayIndex: number,
  slot: string,
  memberIds: readonly string[],
  { sweepHousehold = true }: { sweepHousehold?: boolean } = {},
): string[] {
  const targets = sweepHousehold
    ? [...memberIds, HOUSEHOLD_CHECKIN_MEMBER]
    : [...memberIds];
  return [...new Set(targets)].map((id) => checkinMapKey(dayIndex, slot, id));
}
