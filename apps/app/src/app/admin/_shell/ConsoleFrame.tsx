import { Suspense, type ReactNode } from "react";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { CommandPalette } from "./CommandPalette";
import { shellLabels } from "./labels";
import { Rail, type NavPromise } from "./Rail";
import { TopBar } from "./TopBar";

/**
 * The console frame (Concept A): skip link, top bar, rail, the page in
 * <main id="main">, and the command palette. Presentational — the layout
 * resolves the admin, the locale/currency cookies and starts the nav-data
 * promise; nothing here awaits it, so the frame paints before the dataset
 * loads and the rail's counts stream in.
 *
 * Pages own their inner layout. <main> scrolls on wide screens (the families
 * page pins its own table + sheet inside it); below 1024px the document
 * scrolls. Pages must not render another <main>.
 */
export function ConsoleFrame({
  locale,
  currency,
  adminEmail,
  nav,
  children,
}: {
  locale: AdminLocale;
  currency: Currency;
  adminEmail: string | null;
  nav: NavPromise;
  children: ReactNode;
}) {
  const labels = shellLabels(locale);
  return (
    <div className="ad-frame">
      <a href="#main" className="ad-skip">
        {labels.skip}
      </a>
      <TopBar
        labels={labels}
        nav={nav}
        locale={locale}
        currency={currency}
        adminEmail={adminEmail}
      />
      <Suspense fallback={<nav className="ad-a-rail" aria-label={labels.nav} />}>
        <Rail labels={labels} nav={nav} />
      </Suspense>
      <main id="main" tabIndex={-1} className="ad-a-main">
        {children}
      </main>
      <CommandPalette labels={labels} nav={nav} />
    </div>
  );
}
