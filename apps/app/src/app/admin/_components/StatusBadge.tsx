import type { AdminLocale } from "@/lib/admin/format";
import { statusLabel } from "@/lib/admin/i18n";

const DOT: Record<string, string> = {
  trialing: "bg-brand-yellow",
  active: "bg-brand-emerald",
  past_due: "bg-red-600",
  cancelled: "bg-brand-ink-muted",
  expired: "bg-brand-ink-muted",
};

// Filled pill tint per status. Text stays ink (or red-700 for past_due) so the
// label always meets contrast — yellow/pink never carry text, only the tint+dot.
const PILL: Record<string, string> = {
  trialing: "bg-brand-yellow/12 text-brand-ink",
  active: "bg-brand-emerald/12 text-brand-ink",
  past_due: "bg-red-600/10 text-red-700",
  cancelled: "bg-brand-ink/8 text-brand-ink-muted",
  expired: "bg-brand-ink/8 text-brand-ink-muted",
};

/** Subscription status as a filled, color-coded pill: a status-tinted background
 * plus a leading dot, with a contrast-safe label. */
export function StatusBadge({
  status,
  locale,
}: {
  status: string | null;
  locale: AdminLocale;
}) {
  const dot = (status && DOT[status]) || "bg-brand-ink/30";
  const pill = (status && PILL[status]) || "bg-brand-ink/8 text-brand-ink-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {statusLabel(status, locale)}
    </span>
  );
}
