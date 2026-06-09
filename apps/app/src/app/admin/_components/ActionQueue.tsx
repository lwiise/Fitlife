import Link from "next/link";
import { PRICING_TIERS, type Tier } from "@fitlife/config";
import type { ActionItem, ActionSeverity } from "@/lib/admin/actionQueue";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber, fmtSar } from "@/lib/admin/format";
import {
  actionQueueKindLabel,
  failureCauseLabel,
  severityLabel,
  t,
  tierLabel,
} from "@/lib/admin/i18n";

const DOT: Record<ActionSeverity, string> = {
  high: "bg-red-600",
  medium: "bg-brand-warm-orange",
  low: "bg-brand-ink-muted",
};

function tierName(tier: string | undefined, locale: AdminLocale): string {
  if (!tier) return "";
  const arName = tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].name_ar : null;
  return tierLabel(tier, locale, arName);
}

function detailFor(item: ActionItem, locale: AdminLocale): string {
  switch (item.kind) {
    case "trial_expiring":
      return [
        `${fmtNumber(item.metric ?? 0, locale)} ${t("days_unit", locale)}`,
        tierName(item.detail, locale),
      ]
        .filter(Boolean)
        .join(" · ");
    case "quiet_high_value":
      return [fmtSar(item.metric ?? 0, locale), tierName(item.detail, locale)]
        .filter(Boolean)
        .join(" · ");
    case "systemic_failures":
      return `${failureCauseLabel(item.detail ?? "", locale)} · ${fmtNumber(item.metric ?? 0, locale)}`;
    default:
      return "";
  }
}

/**
 * Prioritized "what to act on now" list — the operating-tool heart of the
 * overview. Each row links to the relevant subscriber (or the product section
 * for systemic failures). Server-rendered; no client JS.
 */
export function ActionQueue({
  items,
  locale,
}: {
  items: ActionItem[];
  locale: AdminLocale;
}) {
  return (
    <section aria-labelledby="admin-action-queue-heading" className="space-y-3">
      <h2 id="admin-action-queue-heading" className="text-lg font-bold text-brand-ink">
        {t("section_action_queue", locale)}
      </h2>

      {items.length === 0 ? (
        <div className="rounded-xl border border-brand-ink/10 bg-surface-elevated px-4 py-6 text-center text-sm text-brand-ink-muted">
          {t("aq_empty", locale)}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const detail = detailFor(item, locale);
            return (
              <li key={i}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-ink/10 bg-surface-elevated px-4 py-2.5 transition-colors hover:border-brand-purple-900/30 hover:bg-brand-surface"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${DOT[item.severity]}`}
                  />
                  <span className="sr-only">{severityLabel(item.severity, locale)}: </span>
                  <span className="font-semibold text-brand-ink">
                    {actionQueueKindLabel(item.kind, locale)}
                  </span>
                  {item.subscriberName ? (
                    <span className="truncate text-sm text-brand-ink-muted">
                      {item.subscriberName}
                    </span>
                  ) : null}
                  {detail ? (
                    <span dir="auto" className="ms-auto whitespace-nowrap text-sm tabular-nums text-brand-ink-muted">
                      {detail}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
