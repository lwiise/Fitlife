"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Ban, ShieldCheck, Trash2, X } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { deleteSubscriberAccount, setSubscriberActive } from "@/app/admin/actions";
import { Btn, IconBtn } from "@/app/admin/_ui/Button";
import { SecTitle } from "@/app/admin/_ui/Card";
import { Note } from "@/app/admin/_ui/Note";
import { Pill } from "@/app/admin/_ui/Pill";
import { joinSep } from "@/app/admin/_ui/Sep";
import { Ltr } from "@/app/admin/_ui/Text";
import { trapTab, useEscapedKeys } from "@/app/admin/_ui/modalFocus";
import {
  accountRefusalText,
  emailMatches,
  familyName,
  type AccountRefusal,
} from "@/app/admin/_family/model";

/**
 * The family page's account actions (the prototype's `dangerZone`), any admin:
 *  - Deactivate / reactivate — a reversible GoTrue ban: sign-in is blocked,
 *    every record is kept. One click; the button reports the round trip.
 *  - Delete — PDPL erasure, irreversible, behind a dialog that asks for the
 *    account's email. The button enables only when the typed email matches
 *    (the server action's own comparison), and the server checks it again.
 *
 * Both submit to the server actions in ../actions.ts, which re-gate
 * (requireAdmin), refuse to touch an admin account (or one they could not
 * check), and write the audit row BEFORE acting; they return to this tab
 * (`?tab=account`), or to the families list once an account is deleted. A
 * refusal is always stated: deactivation's on this tab (`?error=`, the page's
 * note), deletion's inside its still-open dialog.
 *
 * No motion library: the dialog appears in place, and the only transitions
 * are the buttons' own CSS ones (off under prefers-reduced-motion).
 */
export function AccountDangerZone({
  userId,
  email,
  displayName,
  deactivated,
  locale,
}: {
  userId: string;
  email: string | null;
  displayName: string | null;
  deactivated: boolean;
  locale: AdminLocale;
}) {
  const titleId = useId();
  return (
    <section className="ad-card ad-panel ad-dz" aria-labelledby={titleId}>
      <SecTitle as="h2" id={titleId}>
        {t("danger_zone", locale)}
      </SecTitle>

      <div className="ad-dz-row">
        <div>
          <div className="ad-fp-dz-title">
            <b>{t(deactivated ? "reactivate_account" : "deactivate_account", locale)}</b>
            <Pill tone={deactivated ? "crit" : "ok"}>
              {t(deactivated ? "account_deactivated" : "account_active", locale)}
            </Pill>
          </div>
          <p>{t(deactivated ? "fp_reactivate_desc" : "deactivate_desc", locale)}</p>
        </div>
        <form action={setSubscriberActive}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={deactivated ? "true" : "false"} />
          <ActiveSubmit deactivated={deactivated} locale={locale} />
        </form>
      </div>

      <DeleteRow userId={userId} email={email} displayName={displayName} locale={locale} />
    </section>
  );
}

/**
 * The deactivate / reactivate button. While the action runs it keeps focus
 * and says so («جارٍ التعطيل…»); a second press is ignored rather than
 * disabling the button under the operator's cursor.
 */
function ActiveSubmit({ deactivated, locale }: { deactivated: boolean; locale: AdminLocale }) {
  const { pending } = useFormStatus();
  const label = deactivated
    ? t(pending ? "fp_reactivating" : "reactivate_account", locale)
    : t(pending ? "fp_deactivating" : "deactivate_account", locale);
  return (
    <Btn
      type="submit"
      variant={deactivated ? "secondary" : "danger"}
      icon={deactivated ? ShieldCheck : Ban}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <span aria-live="polite">{label}</span>
    </Btn>
  );
}

function DeleteRow({
  userId,
  email,
  displayName,
  locale,
}: {
  userId: string;
  email: string | null;
  displayName: string | null;
  locale: AdminLocale;
}) {
  const noEmailId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The element the dialog is portalled into; null = closed.
  const [host, setHost] = useState<HTMLElement | null>(null);

  function openDialog() {
    const trigger = triggerRef.current;
    const frame =
      trigger?.closest<HTMLElement>(".ad-frame") ?? trigger?.closest<HTMLElement>(".admin-root");
    setHost(frame ?? document.body);
  }

  function closeDialog() {
    setHost(null);
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  }

  return (
    <div className="ad-dz-row">
      <div>
        <b>{t("delete_account", locale)}</b>
        <p>{t("delete_desc", locale)}</p>
        {email ? null : (
          <p id={noEmailId} className="ad-bad">
            {t("fp_delete_no_email", locale)}
          </p>
        )}
      </div>
      {/* A plain button (Btn's look) because focus returns to it by ref. */}
      <button
        ref={triggerRef}
        type="button"
        className="ad-btn ad-btn-d"
        aria-haspopup="dialog"
        aria-expanded={host !== null}
        aria-disabled={email ? undefined : true}
        aria-describedby={email ? undefined : noEmailId}
        onClick={() => {
          if (email) openDialog();
        }}
      >
        <Trash2 className="ad-ic" aria-hidden="true" />
        {t("delete_account", locale)}
      </button>
      {host && email
        ? createPortal(
            <DeleteDialog
              userId={userId}
              email={email}
              displayName={displayName}
              locale={locale}
              onClose={closeDialog}
            />,
            host,
          )
        : null}
    </div>
  );
}

/**
 * The delete action as a form action whose pending state and answer the
 * dialog can read. A completed erasure redirects (to the families list), so
 * it never returns here; a refused one returns why, and the dialog says it.
 */
async function deleteAction(
  _previous: AccountRefusal | null,
  formData: FormData,
): Promise<AccountRefusal | null> {
  return deleteSubscriberAccount(formData);
}

/**
 * The delete confirmation (the prototype's delete modal): what will be
 * erased, then the account's email typed back. A real modal — Tab stays
 * inside, Esc, the close button, Cancel or a click on the scrim close it and
 * focus returns to «حذف الحساب»; the page behind cannot scroll (admin.css
 * locks it while any console scrim is open). Once the deletion is running
 * nothing closes it, so the operator never loses sight of an erasure in
 * flight; and when the server refuses it — the email it holds differs, the
 * account is an admin's, a check or the audit row failed — the dialog stays
 * open and says why (an alert), and that nothing was deleted.
 */
function DeleteDialog({
  userId,
  email,
  displayName,
  locale,
  onClose,
}: {
  userId: string;
  email: string;
  displayName: string | null;
  locale: AdminLocale;
  onClose: () => void;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const warnId = `${baseId}-warn`;
  const inputId = `${baseId}-email`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  // The last attempt's refusal, if it was refused; hidden while a retry runs.
  const [refusal, submit, pending] = useActionState(deleteAction, null);
  const matches = emailMatches(typed, email);

  function close() {
    if (!pending) onClose();
  }

  // The field is the next thing to do; the destructive button stays disabled
  // until it matches, so focusing it first is safe.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onDialogKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (dialogRef.current) trapTab(event, dialogRef.current);
  }

  useEscapedKeys({ open: true, containerRef: dialogRef, onEscape: close });

  function onConfirmClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <div
      className="ad-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={warnId}
        aria-busy={pending || undefined}
        tabIndex={-1}
        onKeyDown={onDialogKey}
      >
        <div className="ad-modal-h">
          <div>
            <h2 id={titleId}>{t("delete_modal_title", locale)}</h2>
            <p>{joinSep(<bdi>{familyName(displayName, locale)}</bdi>, <Ltr mono>{email}</Ltr>)}</p>
          </div>
          <IconBtn label={t("fm_close", locale)} icon={X} onClick={close} disabled={pending} />
        </div>
        <form action={submit} className="ad-fp-dform">
          <input type="hidden" name="userId" value={userId} />
          <div className="ad-modal-b">
            <p id={warnId}>{t("delete_modal_warn", locale)}</p>
            <ul className="ad-del-list">
              <li>{t("delete_item_account", locale)}</li>
              <li>{t("delete_item_family", locale)}</li>
              <li>{t("fp_delete_item_plans", locale)}</li>
              <li>{t("delete_item_billing", locale)}</li>
            </ul>
            <label htmlFor={inputId} className="ad-field-label">
              {t("delete_confirm_prompt", locale)}
            </label>
            <div className="ad-search">
              <input
                ref={inputRef}
                id={inputId}
                name="confirmEmail"
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                translate="no"
                placeholder={email}
                value={typed}
                readOnly={pending}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
            {refusal && !pending ? (
              <Note tone="crit" role="alert">
                {accountRefusalText(refusal, locale)}
              </Note>
            ) : null}
          </div>
          <div className="ad-modal-f">
            <Btn variant="ghost" onClick={close} disabled={pending}>
              {t("action_cancel", locale)}
            </Btn>
            <Btn
              type="submit"
              variant="danger-solid"
              icon={Trash2}
              disabled={!matches}
              aria-disabled={pending || undefined}
              aria-busy={pending || undefined}
              onClick={onConfirmClick}
            >
              <span aria-live="polite">
                {t(pending ? "deleting" : "delete_confirm_btn", locale)}
              </span>
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
