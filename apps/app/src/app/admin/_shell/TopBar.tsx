import Link from "next/link";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { initialOf } from "../_ui/Avatar";
import { CurrencyToggle } from "./CurrencyToggle";
import type { ShellLabels } from "./labels";
import { LocaleToggle } from "./LocaleToggle";
import { MobileDrawer } from "./MobileDrawer";
import { PaletteTrigger } from "./PaletteTrigger";
import { PhoneBarTitle } from "./PhoneBarTitle";
import type { NavPromise } from "./Rail";

/**
 * The 64px top bar spanning the frame: brand block aligned to the rail, the
 * palette field starting at the main column's gutter, then currency,
 * language and the signed-in admin. Below 1024px it becomes the phone bar —
 * 56px, sticky — with the drawer's menu button, the page's title or its way
 * back (PhoneBarTitle) and a search icon; the brand and the switches move
 * into the drawer.
 */
export function TopBar({
  labels,
  nav,
  locale,
  currency,
  adminEmail,
}: {
  labels: ShellLabels;
  nav: NavPromise;
  locale: AdminLocale;
  currency: Currency;
  adminEmail: string | null;
}) {
  return (
    <header className="ad-a-top">
      <div className="ad-top-start">
        <MobileDrawer
          labels={labels}
          nav={nav}
          locale={locale}
          currency={currency}
          adminEmail={adminEmail}
        />
        <Link href="/admin" className="ad-brand ad-desk-only">
          <span className="ad-logo" translate="no" aria-hidden="true">
            FL
          </span>
          <span className="ad-brand-name">{labels.app}</span>
        </Link>
        <PhoneBarTitle labels={labels} />
      </div>
      <PaletteTrigger
        variant="bar"
        label={labels.searchAny}
        placeholder={labels.searchAny}
        className="ad-desk-only"
      />
      <div className="ad-right">
        <PaletteTrigger variant="icon" label={labels.search} className="ad-phone-only" />
        <div className="ad-toggles ad-desk-only">
          <CurrencyToggle currency={currency} labels={labels} />
          <LocaleToggle locale={locale} labels={labels} />
        </div>
        {adminEmail ? (
          <span
            className="ad-avatar ad-desk-only"
            role="img"
            aria-label={`${labels.account}: ${adminEmail}`}
            title={adminEmail}
          >
            {initialOf(adminEmail)}
          </span>
        ) : null}
      </div>
    </header>
  );
}
