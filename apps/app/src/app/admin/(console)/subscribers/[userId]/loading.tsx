import { t } from "@/lib/admin/i18n";

/**
 * Loading skeleton for the subscriber drill-down (and its /health and
 * /plan/[planId] children). The App Router renders this as the Suspense fallback
 * for the whole route segment, so a slow detail fetch shows structure instead of
 * blocking. Mirrors the page's chrome (back link, avatar, name) + 2-col card
 * grid + stacked tables. Respects prefers-reduced-motion via globals.css.
 */
export default function SubscriberDetailLoading() {
  return (
    <>
      <header className="border-b border-brand-ink/5 bg-surface-elevated">
        <div className="container-app py-4">
          <div className="h-5 w-28 animate-pulse rounded bg-brand-ink/10" />
          <div className="mt-3 flex items-center gap-3">
            <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-brand-ink/10" />
            <div className="space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-brand-ink/10" />
              <div className="h-3.5 w-32 animate-pulse rounded bg-brand-ink/10" />
            </div>
          </div>
        </div>
      </header>
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
