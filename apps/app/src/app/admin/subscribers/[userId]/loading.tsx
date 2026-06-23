import { t } from "@/lib/admin/i18n";

/**
 * Loading skeleton for the subscriber drill-down (and its /health and
 * /plan/[planId] children). The App Router renders this as the Suspense fallback
 * for the whole route segment, so a slow detail fetch shows structure instead of
 * blocking. Mirrors the page's chrome + 2-col card grid + stacked tables.
 * Respects prefers-reduced-motion via globals.css.
 */
export default function SubscriberDetailLoading() {
  return (
    <>
      <div className="h-28 border-b border-brand-ink/5 bg-surface-elevated" />
      <main
        className="container-app space-y-4 py-6"
        aria-busy="true"
        aria-label={t("loading_label", "ar")}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated"
            />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated"
          />
        ))}
      </main>
    </>
  );
}
