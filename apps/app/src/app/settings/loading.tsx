/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Mirrors page.tsx: header, the
 * grouped account links, then the account / data / legal cards.
 */
export default function SettingsLoading() {
  return (
    <main className="container-shell py-6 lg:py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-brand-card" />
          <div className="h-5 w-64 max-w-full animate-pulse rounded-lg bg-brand-card" />
        </div>
        <div className="h-64 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-52 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-40 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-32 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
      </div>
    </main>
  );
}
