"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { IconBtn } from "../_ui/Button";
import { focusIsLost, tabbablesIn, trapTab, useEscapedKeys } from "../_ui/modalFocus";
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
 * returns to the menu button. Growing past 1024px, or a browser back/forward,
 * closes it too.
 *
 * Choosing a link returns focus only if nothing else took it: the families
 * page handles «العائلات» in place (a view switch, no navigation) and may
 * move focus itself, and a navigation can land focus in the new page — but
 * neither is guaranteed, and the unmounted drawer would otherwise leave a
 * keyboard or screen-reader user on <body>, nowhere in the page.
 *
 * The panel itself is focusable (tabIndex -1), so a tap on its plain text or
 * padding keeps focus inside it — the keys keep working — instead of dropping
 * focus to <body>; useEscapedKeys covers any other way focus gets out.
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

  /** `ifLost`: give focus back only when the closing left it nowhere. */
  function close(restore: "always" | "ifLost" = "always") {
    setOpen(false);
    requestAnimationFrame(() => {
      const button = buttonRef.current;
      if (!button?.isConnected) return;
      if (restore === "ifLost" && !focusIsLost()) return;
      button.focus();
    });
  }

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    (tabbablesIn(panel)[0] ?? panel).focus();
    const wide = window.matchMedia(WIDE_QUERY);
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    // Back/forward (the phone's back gesture) leaves the page it was opened on.
    const onPop = () => setOpen(false);
    wide.addEventListener("change", onChange);
    window.addEventListener("popstate", onPop);
    return () => {
      wide.removeEventListener("change", onChange);
      window.removeEventListener("popstate", onPop);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (panelRef.current) trapTab(event, panelRef.current);
  }

  useEscapedKeys({ open, containerRef: panelRef, onEscape: () => close() });

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
            tabIndex={-1}
            onClick={(event) => {
              // Choosing a destination closes the drawer.
              if ((event.target as HTMLElement).closest("a[href]")) close("ifLost");
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
