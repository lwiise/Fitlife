"use client";

import type { ReactNode, RefObject } from "react";
import { clsx } from "clsx";
import { Check, Clock, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";

export interface MemberSheetMember {
  id: string;
  name: string;
  /** «أنتِ ·» before the owner's own name. */
  prefix?: string;
  /** Position in the plan's roster — the avatar colour everywhere in the app. */
  rosterIndex: number;
  /** One line under the name: calories, «قيد التحضير», a translation state. */
  status?: { text: string; icon?: "spinner" | "clock" };
}

/**
 * «أفراد البيت»: the member switcher behind the plan bar's identity. The
 * selected person is marked by tint, a check AND aria-current — never colour
 * alone.
 */
export function MemberSheet({
  open,
  onClose,
  title,
  subtitle,
  members,
  selectedId,
  onSelect,
  footer,
  dir,
  lang,
  closeLabel,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** «أفراد البيت» */
  title: string;
  /** The week range. */
  subtitle?: string;
  members: MemberSheetMember[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Add-member / cook rows, styled with PLAN_MENU_ITEM_CLASS. */
  footer?: ReactNode;
  dir?: "rtl" | "ltr";
  lang?: string;
  closeLabel?: string;
  /** The trigger that opened it — focus goes back there on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      dir={dir}
      lang={lang}
      closeLabel={closeLabel}
      returnFocusRef={returnFocusRef}
    >
      <ul className="flex flex-col gap-0.5">
        {members.map((m) => {
          const selected = m.id === selectedId;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                aria-current={selected ? "true" : undefined}
                className={clsx(
                  "flex min-h-[3.75rem] w-full items-center gap-3 rounded-2xl px-3 py-2 text-start transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900",
                  selected ? "bg-brand-tint" : "hover:bg-brand-surface",
                )}
              >
                {/* lg + a larger box: an override only wins upward (see Avatar). */}
                <Avatar name={m.name} rosterIndex={m.rosterIndex} size="lg" className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold leading-snug text-brand-ink">
                    {m.prefix && (
                      <span className="font-medium text-brand-ink-muted">{m.prefix} </span>
                    )}
                    {m.name}
                  </span>
                  {m.status && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-meta text-brand-ink-muted">
                      {m.status.icon === "spinner" && (
                        <Loader2
                          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      )}
                      {m.status.icon === "clock" && (
                        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{m.status.text}</span>
                    </span>
                  )}
                </span>
                {selected && (
                  <Check className="size-5 shrink-0 text-brand-purple-900" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {footer && (
        // Footer rows are links: navigating away dismisses the sheet with it.
        <div
          className="mt-2 border-t border-brand-line pt-2"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) onClose();
          }}
        >
          {footer}
        </div>
      )}
    </Sheet>
  );
}
