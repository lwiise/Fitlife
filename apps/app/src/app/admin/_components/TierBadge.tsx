import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { AdminLocale } from "@/lib/admin/format";
import { tierLabel } from "@/lib/admin/i18n";

const DOT: Record<string, string> = {
  starter: "bg-brand-ink-muted",
  pro: "bg-brand-purple-900",
  family: "bg-brand-pink",
  premium: "bg-brand-yellow",
};

/** Tier as a bordered pill with a tier-colored leading dot (color on the dot
 * only — keeps pink/yellow out of text per the contrast rules). */
export function TierBadge({
  tier,
  locale,
}: {
  tier: string | null;
  locale: AdminLocale;
}) {
  if (!tier) return <span className="text-brand-ink-muted">—</span>;
  const arName = tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  const dot = DOT[tier] ?? "bg-brand-ink/30";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-ink/10 bg-brand-surface px-2.5 py-0.5 text-xs font-medium text-brand-ink">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {tierLabel(tier, locale, arName)}
    </span>
  );
}
