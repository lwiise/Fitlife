/**
 * Route skeleton — the same blocks as the page (greeting, today's table,
 * season/tiles column), so nothing jumps when it resolves. Static markup;
 * animate-pulse is disabled under prefers-reduced-motion (globals.css).
 */
const block = "animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card";

export default function DashboardLoading() {
  return (
    <main className="container-shell py-6 lg:py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mb-5 space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-brand-card" />
        <div className="h-9 w-56 animate-pulse rounded-lg bg-brand-card lg:h-11" />
        <div className="h-5 w-full max-w-md animate-pulse rounded bg-brand-card" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-4 lg:col-span-7">
          <div className={`${block} h-96`} />
          <div className={`${block} h-28`} />
        </div>
        <div className="space-y-4 lg:col-span-5">
          <div className={`${block} h-80`} />
          <div className="grid grid-cols-2 gap-3">
            <div className={`${block} h-24`} />
            <div className={`${block} h-24`} />
            <div className={`${block} h-24`} />
            <div className={`${block} h-24`} />
          </div>
        </div>
      </div>
    </main>
  );
}
