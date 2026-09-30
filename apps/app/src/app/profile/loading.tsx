/**
 * Route skeleton shown during server-component navigation. Static RSC markup
 * only — no client JS; animate-pulse is disabled globally under
 * prefers-reduced-motion (globals.css). Root layout provides lang/dir.
 * Mirrors page.tsx: «رجوع» and the header, the two grouped lists, the note.
 * The /profile/* forms open with the same back row and header.
 */
export default function ProfileLoading() {
  return (
    <main className="container-shell py-6 lg:py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex h-11 items-center">
            <div className="h-5 w-16 animate-pulse rounded-lg bg-brand-card" />
          </div>
          <div className="h-9 w-40 animate-pulse rounded-lg bg-brand-card" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded-lg bg-brand-card" />
        </div>
        <div className="h-60 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-44 animate-pulse rounded-[1.375rem] border border-brand-line bg-brand-card" />
        <div className="h-5 w-64 max-w-full animate-pulse rounded-lg bg-brand-card" />
      </div>
    </main>
  );
}
