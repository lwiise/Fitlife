"use client";

import type { RefObject } from "react";
import type { WeekChange } from "@fitlife/plan-engine";
import { SaraAvatar } from "@/components/ui/SaraAvatar";
import { Sheet } from "@/components/ui/sheet";
import { genderPick } from "@/lib/copy/gender";

/**
 * «ما عدّلته سارة هذا الأسبوع» — the full note behind the toast and the •••
 * row. Leads with each adaptation; the evidence from her logged week sits
 * quietly beneath it, never a list of what the family failed to do (contract:
 * engagement-layer-brainstorm.md §4.3). The engine already applied the
 * minimum-signal guard, so non-empty `changes` are safe to show.
 */
export function SaraChangesSheet({
  open,
  onClose,
  changes,
  ownerSex,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  changes: ReadonlyArray<WeekChange>;
  ownerSex: string | null | undefined;
  /** The trigger it belongs to — ••• — even when the toast opened it: the
   * toast is gone by the time the sheet closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const g = genderPick(ownerSex);
  // The schema trims to 3; the toast counts from the same slice.
  const shown = changes.slice(0, 3);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ما عدّلته سارة هذا الأسبوع"
      returnFocusRef={returnFocusRef}
      subtitle={g(
        "بناءً على ما سجّلتِه في أسبوعكِ الماضي",
        "بناءً على ما سجّلتَه في أسبوعك الماضي",
      )}
    >
      <div className="px-3 pb-2">
        {/* Her name is written beside the portrait, so the image itself is
            decorative — an alt here would read «سارة» twice. */}
        <div className="flex items-center gap-3 py-2">
          <SaraAvatar size={56} />
          <p className="min-w-0">
            <span className="block text-base font-extrabold leading-snug text-brand-ink">سارة</span>
            <span className="block text-meta text-brand-ink-muted">
              {g("مدرّبتكِ الغذائية", "مدرّبتك الغذائية")}
            </span>
          </p>
        </div>
        {shown.length > 0 ? (
          <ul className="mt-1 divide-y divide-brand-line border-t border-brand-line">
            {shown.map((c, i) => (
              <li key={i} className="py-3">
                <p className="text-base font-extrabold leading-relaxed text-brand-ink">{c.change_ar}</p>
                <p className="mt-1 text-meta text-brand-ink-muted">{c.because_ar}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-base text-brand-ink-muted">لا تعديلات على خطة هذا الأسبوع.</p>
        )}
      </div>
    </Sheet>
  );
}
