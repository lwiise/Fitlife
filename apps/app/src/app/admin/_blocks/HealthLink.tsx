"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link, { useLinkStatus } from "next/link";
import { Lock, Shield, X } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { healthHref } from "./helpers";

/**
 * Opens the audited health page through one extra, deliberate step: a small
 * dialog says the view is recorded in the audit log, and only «متابعة»
 * navigates. The health values themselves never reach this component — the
 * page loads and logs them.
 *
 * `appearance`: "button" (outlined, default — page headers and panels) or
 * "link" (the side panel's inline purple link). `children` replaces the
 * default label («عرض التفاصيل الصحية (مُسجّل)»).
 *
 * The dialog is portalled into the console frame (the closest `.ad-frame`,
 * else `.admin-root`) so a scrolling or fixed ancestor such as the side panel
 * cannot clip it, while it keeps the console's type and tokens. Esc, the
 * close button, Cancel or a click on the scrim close it and return focus to
 * the trigger; Tab stays inside while it is open.
 */
export function HealthLink({
  userId,
  locale,
  appearance = "button",
  children,
}: {
  userId: string;
  locale: AdminLocale;
  appearance?: "button" | "link";
  children?: ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;
  const open = host !== null;

  function openDialog() {
    const trigger = triggerRef.current;
    const frame =
      trigger?.closest<HTMLElement>(".ad-frame") ?? trigger?.closest<HTMLElement>(".admin-root");
    setHost(frame ?? document.body);
  }

  function close() {
    setHost(null);
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  }

  // Focus the safe choice first: this dialog guards a sensitive, logged view.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  function onDialogKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const nodes = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.getClientRects().length > 0);
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

  const dialog = (
    <div
      className="ad-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="ad-modal ad-narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onDialogKey}
      >
        <div className="ad-modal-h">
          <div>
            <h2 id={titleId}>{t("fm_health_dialog_title", locale)}</h2>
            <p id={bodyId}>{t("fm_health_dialog_body", locale)}</p>
          </div>
          <button
            type="button"
            className="ad-iconbtn"
            aria-label={t("fm_close", locale)}
            title={t("fm_close", locale)}
            onClick={close}
          >
            <X className="ad-ic" aria-hidden="true" />
          </button>
        </div>
        <div className="ad-modal-b">
          <div className="ad-note ad-audit" role="note">
            <Shield className="ad-ic" aria-hidden="true" />
            <span>{t("fm_health_dialog_audit", locale)}</span>
          </div>
        </div>
        <div className="ad-modal-f">
          <button ref={cancelRef} type="button" className="ad-btn ad-btn-g" onClick={close}>
            {t("action_cancel", locale)}
          </button>
          <Link href={healthHref(userId)} prefetch={false} className="ad-btn ad-btn-p">
            <ContinueLabel locale={locale} />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={appearance === "link" ? "ad-link" : "ad-btn ad-btn-s"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDialog}
      >
        <Lock className="ad-ic" aria-hidden="true" />
        {children ?? t("view_health", locale)}
      </button>
      {host ? createPortal(dialog, host) : null}
    </>
  );
}

/** «متابعة», then «جارٍ الفتح…» while the navigation is pending. */
function ContinueLabel({ locale }: { locale: AdminLocale }) {
  const { pending } = useLinkStatus();
  return <span aria-live="polite">{t(pending ? "fm_opening" : "fm_continue", locale)}</span>;
}
