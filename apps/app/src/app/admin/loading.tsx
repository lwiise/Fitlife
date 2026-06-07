import { t } from "@/lib/admin/i18n";

/** Admin loading skeleton (respects prefers-reduced-motion via globals.css). */
export default function AdminLoading() {
  return (
    <>
      <div className="h-[4.5rem] border-b border-brand-ink/10 bg-surface-elevated" />
      <main
        className="container-app space-y-6 py-6"
        aria-busy="true"
        aria-label={t("loading_label", "ar")}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-brand-ink/10 bg-surface-elevated" />
      </main>
    </>
  );
}
