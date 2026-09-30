/**
 * The families list's display strings, formatted once on the server (see
 * FamilyRowText for why). Pure: the page passes the request's locale,
 * currency and "now"; nothing here reads the clock.
 *
 * Every family is formatted per request, so the Intl formatters are built
 * ONCE per call, not once per value: the shared helpers (fmtMoney, fmtDay,
 * fmtRelativeTo) construct a new formatter on every call, ~0.1ms each —
 * about a second for two thousand families, against ~30ms here. The output
 * is theirs exactly; rowText.test.ts compares the two over a spread of
 * values, so a change to the helpers' options fails the suite instead of
 * quietly splitting the list's text from the rest of the console.
 */

import type { FamilyRow } from "@/lib/admin/console-types";
import { renewalDateAt } from "@/lib/admin/familyFlags";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { usdToSar } from "@/lib/admin/revenue";
import { isIsoDay } from "../_blocks/helpers";
import type { FamilyRowText } from "./types";

export interface RowTextOptions {
  locale: AdminLocale;
  currency: Currency;
  /** The request's "now" (ISO) — relative times are measured from it. */
  nowIso: string;
}

/** format.ts's locale tags (numbers, money, relative times). */
const NUMBER_TAG: Record<AdminLocale, string> = { ar: "ar-SA", en: "en-US" };
/** _blocks/helpers.ts's date tags: the Gregorian calendar pinned for Arabic. */
const DATE_TAG: Record<AdminLocale, string> = { ar: "ar-SA-u-ca-gregory", en: "en-US" };

const DAY_MS = 86_400_000;
/** format.ts's relative-time steps, largest first. */
const RELATIVE_STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

type RowTextFormatter = (row: FamilyRow) => FamilyRowText;

/** One row's strings, with the formatters built once for every row after it. */
export function rowTextFormatter({ locale, currency, nowIso }: RowTextOptions): RowTextFormatter {
  const dayOptions = { year: "numeric", month: "short", day: "numeric" } as const;
  // fmtDay: a timestamp is dated in Riyadh; a plain YYYY-MM-DD stays the day it names.
  const riyadhDay = new Intl.DateTimeFormat(DATE_TAG[locale], { ...dayOptions, timeZone: "Asia/Riyadh" });
  const calendarDay = new Intl.DateTimeFormat(DATE_TAG[locale], { ...dayOptions, timeZone: "UTC" });
  // fmtMoney(usd, currency, locale, 2): SAR converted at the platform rate, two decimals.
  const money = new Intl.NumberFormat(NUMBER_TAG[locale], {
    style: "currency",
    currency: currency === "usd" ? "USD" : "SAR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const relative = new Intl.RelativeTimeFormat(NUMBER_TAG[locale], { numeric: "auto" });
  const nowMs = Date.parse(nowIso);

  const day = (iso: string | null): string => {
    if (!iso) return "—";
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return "—";
    return (isIsoDay(iso) ? calendarDay : riyadhDay).format(new Date(ms));
  };

  // fmtRelativeTo: the plain day when "now" is unusable.
  const ago = (iso: string): string => {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return "—";
    if (Number.isNaN(nowMs)) return day(iso);
    const diff = ms - nowMs;
    for (const [unit, size] of RELATIVE_STEPS) {
      if (Math.abs(diff) >= size || unit === "minute") return relative.format(Math.round(diff / size), unit);
    }
    return relative.format(0, "minute");
  };

  return (row) => {
    const last = row.lastActivityAt;
    const cost = row.lifetimeAiCostUsd;
    return {
      // The old list's cost column: two decimals, «—» when nothing was spent.
      cost: cost > 0 ? money.format(currency === "usd" ? cost : usdToSar(cost)) : null,
      signup: day(row.signupAt),
      last: last ? ago(last) : null,
      lastDay: last ? day(last) : null,
      renewal: day(renewalDateAt(row)),
    };
  };
}

export function familyRowText(row: FamilyRow, options: RowTextOptions): FamilyRowText {
  return rowTextFormatter(options)(row);
}

/** Every row's strings, keyed by family id. */
export function familyRowTexts(
  rows: readonly FamilyRow[],
  options: RowTextOptions,
): Record<string, FamilyRowText> {
  const format = rowTextFormatter(options);
  const out: Record<string, FamilyRowText> = {};
  for (const row of rows) out[row.userId] = format(row);
  return out;
}
