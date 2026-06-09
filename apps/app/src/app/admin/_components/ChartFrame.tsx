import type { ReactNode } from "react";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";

/**
 * Shared wrapper giving every chart explicit empty / error states and an
 * optional caption (approximation or "est." notes). Loading is handled by the
 * page/section <Suspense> boundary, not here. The chart itself (passed as
 * children) carries its own <figure> + sr-only data table.
 */
export function ChartFrame({
  ariaLabel,
  note,
  state = "ready",
  locale,
  children,
}: {
  ariaLabel: string;
  /** Approximation / "est." caption rendered under the chart. */
  note?: string;
  state?: "ready" | "empty" | "error";
  locale: AdminLocale;
  children: ReactNode;
}) {
  if (state !== "ready") {
    return (
      <div
        role="note"
        aria-label={ariaLabel}
        className="grid min-h-40 place-items-center rounded-lg border border-dashed border-brand-ink/15 bg-brand-surface/50 p-6 text-center"
      >
        <p className="text-sm text-brand-ink-muted">
          {t(state === "empty" ? "chart_empty" : "chart_error", locale)}
        </p>
      </div>
    );
  }

  return (
    <div>
      {children}
      {note ? (
        <p className="mt-2 text-xs leading-snug text-brand-ink-muted">{note}</p>
      ) : null}
    </div>
  );
}
