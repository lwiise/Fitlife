import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Trend } from "@/lib/admin/period";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtSignedPct } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";

/**
 * Polarity-aware trend indicator. `polarity` says which direction is "good":
 * for revenue/signups a rise is positive (green); for churn/AI-spend a rise is
 * negative (red). Flat or unknown (null pct) reads neutral.
 */
export function TrendPill({
  trend,
  polarity = "positive",
  onFilled = false,
  locale,
}: {
  trend: Trend;
  polarity?: "positive" | "negative";
  /** Set on a dark/filled card: uses a solid white chip so the delta stays
   * legible (emerald/red text on white) instead of a translucent tint. */
  onFilled?: boolean;
  locale: AdminLocale;
}) {
  const { direction, pct } = trend;

  const isGood =
    (direction === "up" && polarity === "positive") ||
    (direction === "down" && polarity === "negative");
  const isBad =
    (direction === "up" && polarity === "negative") ||
    (direction === "down" && polarity === "positive");

  // On a filled (purple) card the chip is solid white with darker-than-brand
  // emerald so the delta clears AA (translucent tints fail on the dark tile).
  const neutral = onFilled
    ? "bg-white text-brand-ink-muted"
    : "bg-brand-ink/5 text-brand-ink-muted";
  const tone =
    direction === "flat" || pct === null
      ? neutral
      : isGood
        ? onFilled
          ? "bg-white text-emerald-700"
          : "bg-brand-emerald/10 text-brand-emerald"
        : isBad
          ? onFilled
            ? "bg-white text-red-700"
            : "bg-red-600/10 text-red-700"
          : neutral;

  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const dirKey =
    direction === "up" ? "trend_up" : direction === "down" ? "trend_down" : "trend_flat";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t(dirKey, locale)} </span>
      <span dir="ltr" className="tabular-nums">
        {fmtSignedPct(pct, locale)}
      </span>
    </span>
  );
}
