import { t } from "@/lib/admin/i18n";

/** Insights loading skeleton (respects prefers-reduced-motion via globals.css). */
export default function InsightsLoading() {
  return (
    <>
      <div className="h-[4.5rem] border-b border-brand-ink/10 bg-surface-elevated" />
      <main
        className="container-app space-y-8 py-6"
        aria-busy="true"
        aria-label={t("loading_label", "ar")}
      >
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s} className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded bg-surface-elevated" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated" />
              <div className="h-64 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated" />
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
