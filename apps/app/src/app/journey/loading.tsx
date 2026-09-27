/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Root layout provides lang/dir.
 */
export default function JourneyLoading() {
  return (
    <main className="min-h-screen bg-brand-surface" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="container-app py-8 space-y-6">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-brand-card" />
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-full bg-brand-card" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-brand-card" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-brand-line bg-brand-card" />
        <div className="h-40 animate-pulse rounded-2xl border border-brand-line bg-brand-card" />
      </div>
    </main>
  );
}
