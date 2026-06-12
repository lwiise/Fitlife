/**
 * Locale-aware formatters for the admin dashboard. Pure. `locale` is the
 * admin-only language ("ar" | "en") — decoupled from the consumer 7-locale
 * system. Arabic uses Arabic-Indic digits via Intl; English uses Latin.
 */

export type AdminLocale = "ar" | "en";

const TAG: Record<AdminLocale, string> = { ar: "ar-SA", en: "en-US" };

export function fmtNumber(n: number, locale: AdminLocale): string {
  return new Intl.NumberFormat(TAG[locale]).format(n);
}

export function fmtUsd(
  n: number,
  locale: AdminLocale,
  maxFractionDigits = 2,
): string {
  return new Intl.NumberFormat(TAG[locale], {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: Math.min(2, maxFractionDigits),
  }).format(n);
}

export function fmtSar(n: number, locale: AdminLocale): string {
  return new Intl.NumberFormat(TAG[locale], {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact SAR (e.g. "1.2K ر.س") for tight tiles and chart axes. */
export function fmtSarCompact(n: number, locale: AdminLocale): string {
  return new Intl.NumberFormat(TAG[locale], {
    style: "currency",
    currency: "SAR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Percent with no fraction digits (cohort cells, gauges). "—" if null. */
export function fmtPctInt(n: number | null | undefined, locale: AdminLocale): string {
  if (n == null) return "—";
  return new Intl.NumberFormat(TAG[locale], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function fmtPct(n: number | null | undefined, locale: AdminLocale): string {
  if (n == null) return "—";
  return new Intl.NumberFormat(TAG[locale], {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(n / 100);
}

export function fmtSignedPct(
  n: number | null | undefined,
  locale: AdminLocale,
): string {
  if (n == null) return "—";
  return new Intl.NumberFormat(TAG[locale], {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(n / 100);
}

export function fmtMonth(iso: string | null | undefined, locale: AdminLocale): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(TAG[locale], {
    month: "short",
    year: "2-digit",
  }).format(new Date(iso));
}

export function fmtDate(iso: string | null | undefined, locale: AdminLocale): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(TAG[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * X-axis label for a time-series bucket. Month buckets show the short month;
 * day/week buckets show day + short month. Localized digits/month names.
 */
export function fmtBucketLabel(
  iso: string | null | undefined,
  granularity: "hour" | "day" | "week" | "month",
  locale: AdminLocale,
): string {
  if (!iso) return "—";
  const opts: Intl.DateTimeFormatOptions =
    granularity === "hour"
      ? { hour: "numeric" }
      : granularity === "month"
        ? { month: "short" }
        : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(TAG[locale], opts).format(new Date(iso));
}

/**
 * Format a metric value by its unit — SAR money (full or compact) or a plain
 * localized count. Used by the Overview metric tabs, chart axis, and tooltip.
 */
export function fmtMetricValue(
  n: number,
  unit: "sar" | "count",
  locale: AdminLocale,
  compact = false,
): string {
  if (unit === "sar") return compact ? fmtSarCompact(n, locale) : fmtSar(n, locale);
  return fmtNumber(n, locale);
}

const REL_DIVISORS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

/** "منذ ٣ أيام" / "3 days ago", relative to now. */
export function fmtRelative(
  iso: string | null | undefined,
  locale: AdminLocale,
  now: Date = new Date(),
): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(TAG[locale], { numeric: "auto" });
  for (const [unit, ms] of REL_DIVISORS) {
    if (Math.abs(diff) >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(0, "minute");
}
