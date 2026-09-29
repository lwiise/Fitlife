"use client";

import { Fragment, useId, type ReactNode, type RefObject } from "react";
import { clsx } from "clsx";
import { Sheet } from "@/components/ui/sheet";

export interface MoreSheetGroup {
  key: string;
  /** A 13px heading row; may carry a 24px avatar. */
  label?: ReactNode;
  /** Rows styled with PLAN_MENU_ITEM_CLASS. */
  items: ReactNode[];
}

/**
 * The plan bar's ••• sheet: secondary actions, grouped by who or what they
 * concern. Deliberately plain links and buttons, not a `role="menu"` — the
 * native Tab order is the interaction model, and a menu role would promise
 * arrow keys this does not implement.
 */
export function MoreSheet({
  open,
  onClose,
  title = "المزيد",
  groups,
  tail,
  dir,
  lang,
  closeLabel,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Empty groups are skipped, heading included. */
  groups: MoreSheetGroup[];
  /** After a hairline — the regenerate row. */
  tail?: ReactNode;
  dir?: "rtl" | "ltr";
  lang?: string;
  closeLabel?: string;
  /** The trigger that opened it — focus goes back there on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const baseId = useId();
  const shown = groups.filter((g) => g.items.length > 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      dir={dir}
      lang={lang}
      closeLabel={closeLabel}
      returnFocusRef={returnFocusRef}
    >
      <div
        // A link navigates away, so the sheet goes with it. Buttons do NOT
        // close it: the PDF row keeps its spinner on screen, and the
        // regenerate row opens a ConfirmDialog that needs the sheet (its
        // owner) mounted underneath.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) onClose();
        }}
      >
        {shown.map((group, i) => {
          const labelId = `${baseId}-${group.key}`;
          return (
            <div
              key={group.key}
              role="group"
              aria-labelledby={group.label ? labelId : undefined}
              className={clsx(i > 0 && "mt-3")}
            >
              {group.label && (
                <div
                  id={labelId}
                  className="flex min-h-8 items-center gap-2 px-3 pb-1 text-meta font-bold text-brand-ink-muted"
                >
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item, j) => (
                  <Fragment key={j}>{item}</Fragment>
                ))}
              </div>
            </div>
          );
        })}
        {tail && (
          <div className={clsx(shown.length > 0 && "mt-2 border-t border-brand-line pt-2")}>
            {tail}
          </div>
        )}
      </div>
    </Sheet>
  );
}
