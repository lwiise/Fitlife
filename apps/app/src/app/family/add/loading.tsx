// Instant feedback while the (dynamic) add-member server render runs.
// Mirrors MemberWizard's shell — sticky header + progress bar + content card —
// so the navigation feels immediate instead of sitting on a frozen page.
export default function Loading() {
  return (
    <main className="min-h-screen bg-brand-surface" aria-busy="true">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 w-28 rounded-md bg-brand-surface animate-pulse" />
            <div className="h-4 w-10 rounded-md bg-brand-surface animate-pulse" />
          </div>
          <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow opacity-40" />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <div className="space-y-3">
          <div className="h-9 w-2/3 rounded-lg bg-white animate-pulse" />
          <div className="h-4 w-1/2 rounded-md bg-white animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-12 w-full rounded-xl bg-white animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-white animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-white animate-pulse" />
        </div>
      </div>

      <span className="sr-only">جاري التحميل</span>
    </main>
  );
}
