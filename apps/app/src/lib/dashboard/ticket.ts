/**
 * Which dish sits on the home screen's kitchen ticket (09/2026, «تذكرة المطبخ»).
 *
 * The ticket holds the MAIN meal (فطور / غداء / عشاء) of the current part of
 * the Riyadh day while it is unanswered. Once answered, it moves FORWARD to the
 * next unanswered main meal and never goes back: an earlier meal left unmarked
 * stays in the day list, where it is still one tap to mark. Snacks never take
 * the ticket. The part of day only CHOOSES the ticket; it never gates marking —
 * every elapsed meal stays markable, exactly as on /plan.
 *
 * Pure: the caller passes the Riyadh hour.
 */

export const MAIN_SLOTS = ["breakfast", "lunch", "dinner"] as const;

/** Breakfast until 11:00, lunch until 17:00, dinner after. Never displayed. */
export function partOfDay(hour: number): (typeof MAIN_SLOTS)[number] {
  if (hour < 11) return "breakfast";
  if (hour < 17) return "lunch";
  return "dinner";
}

export interface TicketCandidate {
  key: string;
  slot: string;
  status: string | null;
  eaterIds: readonly string[];
}

export function pickTicket<T extends TicketCandidate>(
  rows: readonly T[],
  hour: number,
): T | null {
  const from = MAIN_SLOTS.indexOf(partOfDay(hour));
  for (let s = from; s < MAIN_SLOTS.length; s++) {
    const open = rows.filter((r) => r.slot === MAIN_SLOTS[s] && r.status === null);
    if (open.length === 0) continue;
    // Two dishes in one slot: the pot that feeds the most people leads.
    return [...open].sort((a, b) => b.eaterIds.length - a.eaterIds.length)[0]!;
  }
  return null;
}
