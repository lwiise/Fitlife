/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Root layout provides lang/dir.
 */
export default function ChatLoading() {
  return (
    <main className="min-h-screen bg-brand-surface flex flex-col" aria-busy="true" aria-label="جارٍ التحميل">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-brand-surface" />
        </div>
      </header>
      <div className="container-app flex-1 py-6 flex flex-col gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-white" />
          <div className="h-12 w-1/2 animate-pulse rounded-2xl bg-white ms-auto" />
          <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-white" />
        </div>
        <div className="h-14 animate-pulse rounded-2xl border border-brand-ink/5 bg-white" />
      </div>
    </main>
  );
}
