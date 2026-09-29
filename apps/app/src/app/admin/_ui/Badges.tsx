import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { AdminLocale } from "@/lib/admin/format";
import { statusLabel, tierLabel } from "@/lib/admin/i18n";
import { Pill, type Tone } from "./Pill";

/** Subscription tier as a tag (`.ad-tier`). A missing tier renders «—». */
export function TierBadge({
  tier,
  locale,
  className,
}: {
  tier: string | null;
  locale: AdminLocale;
  className?: string;
}) {
  if (!tier) return <span className="ad-muted">—</span>;
  const arName = tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return (
    <span className={className ? `ad-tier ${className}` : "ad-tier"}>
      {tierLabel(tier, locale, arName)}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  trialing: "pur",
  active: "ok",
  past_due: "crit",
  cancelled: "neu",
  expired: "neu",
};

/** The tone a subscription status is shown in (unknown / none → neutral). */
export function statusTone(status: string | null): Tone {
  return (status && STATUS_TONE[status]) || "neu";
}

/** Subscription status as a toned pill; `null` reads «بدون اشتراك». */
export function StatusPill({
  status,
  locale,
  className,
}: {
  status: string | null;
  locale: AdminLocale;
  className?: string;
}) {
  return (
    <Pill tone={statusTone(status)} className={className}>
      {statusLabel(status, locale)}
    </Pill>
  );
}
