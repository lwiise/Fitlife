/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Root layout provides lang/dir.
 */
export default function PlanLoading() {
  return (
    <main className="min-h-screen bg-brand-surface" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="container-app py-6 space-y-5">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-white" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 w-16 shrink-0 animate-pulse rounded-full bg-white" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-2xl border border-brand-ink/5 bg-white" />
        <div className="h-56 animate-pulse rounded-2xl border border-brand-ink/5 bg-white" />
      </div>
    </main>
  );
}
