/**
 * Display units and number formatting for the overview (client-safe: no
 * dictionary, no server imports).
 *
 * Revenue metrics are SAR-native. When the operator shows USD, every value is
 * converted ONCE into display units and the axis, tiles, tooltip and table all
 * format those — so ticks land on round numbers of the currency on screen and
 * the chart's end label equals the tile's headline to the cent.
 *
 * Only NUMBERS are formatted here. Dates are always formatted on the server:
 * Node's ICU and the browser's resolve `ar-SA` to different calendars
 * (Gregorian vs Umm al-Qura), so a date formatted in the browser would differ
 * from the rest of the console and from its own server render.
 */

import { fmtNumber, fmtSar, fmtUsd, type AdminLocale, type Currency } from "@/lib/admin/format";
import { sarToUsd } from "@/lib/admin/revenue";
import type { MetricUnit } from "@/lib/admin/timeseries";

const TAG: Record<AdminLocale, string> = { ar: "ar-SA", en: "en-US" };

/** A money string's number and currency never break apart. */
export function keepTogether(s: string): string {
  return s.replace(/ /g, " ");
}

/** Replace `{name}` placeholders in a resolved string. Unknown names stay. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole);
}

/** A metric value (SAR-native for revenue) in the currency on screen. */
export function toDisplay(v: number, unit: MetricUnit, currency: Currency): number {
  return unit === "sar" && currency === "usd" ? sarToUsd(v) : v;
}

/**
 * Format a value already in display units. Identical output to
 * `fmtMetricValue(raw, unit, locale, currency)` for `v = toDisplay(raw)`:
 * whole riyals, dollars to the cent, localized counts.
 */
export function fmtDisplay(
  v: number,
  unit: MetricUnit,
  currency: Currency,
  locale: AdminLocale,
): string {
  if (unit === "count") return fmtNumber(v, locale);
  return keepTogether(currency === "usd" ? fmtUsd(v, locale, 2) : fmtSar(v, locale, 0));
}

/** Fraction digits that show every quarter of `max` exactly (0–2). */
export function tickDigits(max: number): number {
  const q = max / 4;
  if (Math.abs(q - Math.round(q)) < 1e-9) return 0;
  if (Math.abs(q * 10 - Math.round(q * 10)) < 1e-9) return 1;
  return 2;
}

/** A y-axis tick: a bare number (the unit is in the title), compact from 100k. */
export function fmtTick(v: number, max: number, locale: AdminLocale): string {
  const compact = max >= 100_000;
  return new Intl.NumberFormat(TAG[locale], {
    maximumFractionDigits: compact ? 1 : tickDigits(max),
    notation: compact ? "compact" : "standard",
  }).format(v);
}
