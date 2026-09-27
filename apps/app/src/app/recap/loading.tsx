/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Mirrors page.tsx: header, the
 * letter card, four figure tiles, the share button.
 */
export default function RecapLoading() {
  return (
    <main className="container-shell py-6 lg:py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-brand-card" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded-lg bg-brand-card" />
        </div>
        <div className="h-72 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card"
            />
          ))}
        </div>
        <div className="h-12 animate-pulse rounded-full bg-brand-card" />
      </div>
    </main>
  );
}
