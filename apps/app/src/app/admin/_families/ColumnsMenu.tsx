"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Columns3 } from "lucide-react";
import { FAMILY_COLUMNS, type FamilyColumn } from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { COLUMN_LABEL } from "./listModel";

/**
 * «الأعمدة · N»: a toggle button and its checkbox popover (the prototype's
 * `aColumnsPop`). The family column is always shown, so it is listed checked
 * and disabled. N counts the visible columns, the family column included.
 *
 * The popover opens with focus on its first checkbox; Esc closes it and
 * returns focus to the button; a press outside it, or Tab past its last
 * checkbox, closes it too.
 */
export function ColumnsMenu({
  hidden,
  onToggle,
  locale,
  className,
}: {
  hidden: readonly FamilyColumn[];
  onToggle: (column: FamilyColumn) => void;
  locale: AdminLocale;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const popId = `${baseId}-pop`;
  const hintId = `${baseId}-hint`;
  const shown = 1 + FAMILY_COLUMNS.filter((column) => !hidden.includes(column)).length;

  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (popRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!next) return;
    if (popRef.current?.contains(next) || buttonRef.current?.contains(next)) return;
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className ? `ad-btn ad-btn-s ad-cols-btn ${className}` : "ad-btn ad-btn-s ad-cols-btn"}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
      >
        <Columns3 className="ad-ic" aria-hidden="true" />
        {t("fl_columns", locale)} · {fmtNumber(shown, locale)}
      </button>
      {open ? (
        <div
          ref={popRef}
          id={popId}
          role="group"
          aria-labelledby={hintId}
          className="ad-pop ad-at-end"
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        >
          <p id={hintId} className="ad-ph">
            {t("fl_columns_hint", locale)}
          </p>
          <label>
            <input type="checkbox" checked disabled readOnly />
            {t("fl_col_family", locale)}
          </label>
          {FAMILY_COLUMNS.map((column) => (
            <label key={column}>
              <input
                type="checkbox"
                checked={!hidden.includes(column)}
                onChange={() => onToggle(column)}
              />
              {t(COLUMN_LABEL[column], locale)}
            </label>
          ))}
        </div>
      ) : null}
    </>
  );
}
