/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Root layout provides lang/dir.
 */
export default function PlanHistoryLoading() {
  return (
    <main className="min-h-screen bg-brand-surface" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="container-app py-6 space-y-4">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-brand-card" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-brand-line bg-brand-card" />
        ))}
      </div>
    </main>
  );
}
