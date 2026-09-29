"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { IconBtn } from "../_ui/Button";
import { CurrencyToggle } from "./CurrencyToggle";
import type { ShellLabels } from "./labels";
import { LocaleToggle } from "./LocaleToggle";
import { RailItems, type NavPromise } from "./Rail";
import { WIDE_QUERY } from "./views";

/**
 * Below 1024px the rail becomes this drawer: a menu button in the top bar
 * opens a modal panel from the inline-start edge with the sections, the
 * language and currency switches and the signed-in address. Focus moves in,
 * Tab stays in, Esc / a tap outside / choosing a link closes it and focus
 * returns to the menu button. Growing past 1024px closes it too.
 */
export function MobileDrawer({
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
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    const wide = window.matchMedia(WIDE_QUERY);
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => el.getClientRects().length > 0 && !el.hasAttribute("disabled"));
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ad-iconbtn ad-phone-only"
        aria-label={labels.menu}
        title={labels.menu}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(true)}
      >
        <Menu className="ad-ic" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="ad-drawer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={onKeyDown}
        >
          <div
            ref={panelRef}
            id={panelId}
            className="ad-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={labels.menu}
            onClick={(event) => {
              // Choosing a destination closes the drawer; the new page takes focus.
              if ((event.target as HTMLElement).closest("a[href]")) close(false);
            }}
          >
            <div className="ad-drawer-top">
              <Link href="/admin" className="ad-brand">
                <span className="ad-logo" translate="no" aria-hidden="true">
                  FL
                </span>
                <span className="ad-brand-name">{labels.app}</span>
              </Link>
              <IconBtn label={labels.close} icon={X} onClick={() => close()} />
            </div>
            <nav aria-label={labels.nav} className="ad-drawer-nav">
              <RailItems labels={labels} nav={nav} variant="drawer" />
            </nav>
            <div className="ad-drawer-foot">
              <div className="ad-row">
                <CurrencyToggle currency={currency} labels={labels} />
                <LocaleToggle locale={locale} labels={labels} />
              </div>
              {adminEmail ? (
                <p className="ad-who">
                  <span dir="ltr" translate="no">
                    {adminEmail}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
