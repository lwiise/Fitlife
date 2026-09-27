/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Mirrors page.tsx: header, member
 * chips, weigh-in card, trend card.
 */
export default function JourneyLoading() {
  return (
    <main className="container-shell py-6 lg:py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-brand-card" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded-lg bg-brand-card" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-20 animate-pulse rounded-full bg-brand-card" />
          <div className="h-11 w-20 animate-pulse rounded-full bg-brand-card" />
        </div>
        <div className="h-64 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-56 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
      </div>
    </main>
  );
}
