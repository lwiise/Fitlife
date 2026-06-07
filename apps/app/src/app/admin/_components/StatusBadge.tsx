import type { AdminLocale } from "@/lib/admin/format";
import { statusLabel } from "@/lib/admin/i18n";

const DOT: Record<string, string> = {
  trialing: "bg-brand-yellow",
  active: "bg-brand-emerald",
  past_due: "bg-red-600",
  cancelled: "bg-brand-ink-muted",
  expired: "bg-brand-ink-muted",
};

/** Subscription status as a colored dot + label. Color-coded, contrast-safe
 * (color carried by the dot, text stays ink — yellow/pink never used as text). */
export function StatusBadge({
  status,
  locale,
}: {
  status: string | null;
  locale: AdminLocale;
}) {
  const dot = (status && DOT[status]) || "bg-brand-ink/30";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-brand-ink">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {statusLabel(status, locale)}
    </span>
  );
}
