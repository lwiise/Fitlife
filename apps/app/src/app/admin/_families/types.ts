/**
 * Shapes the families page hands from its server component to the client
 * console. Plain JSON only — they cross the server → client boundary.
 */

/**
 * One family row's display strings, formatted ONCE on the server (see
 * rowText.ts). Dates, money and relative times depend on the ICU build that
 * formats them; Node's and the browser's can differ (currency symbols, date
 * patterns), and a list that is server-rendered and then hydrated must print
 * the same text both times. The same reason the frame formats its rail
 * counts on the server (_shell/navData.ts).
 */
export interface FamilyRowText {
  /** Lifetime AI cost in the operator's currency; null when nothing was spent. */
  cost: string | null;
  /** Signup date. */
  signup: string;
  /** Last activity, relative to the request («قبل ٣ أيام»); null = never active. */
  last: string | null;
  /** Last activity's calendar date, for the tooltip. */
  lastDay: string | null;
  /** The renewal cell's date: the trial end while trialing, else the period end («—» when unset). */
  renewal: string;
}

/** A filter <option>, labelled on the server. */
export interface SelectOption {
  value: string;
  label: string;
}
