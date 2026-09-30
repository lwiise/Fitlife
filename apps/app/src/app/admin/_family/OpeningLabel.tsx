"use client";

import { useLinkStatus } from "next/link";

/**
 * The label of a button that opens an audited full view (the meal plan, the
 * program): its own text, then «جارٍ الفتح…» while the navigation is pending.
 * Those links never prefetch, because opening them is the audited access, so
 * without this the first sign of a click would be the next page arriving.
 *
 * Both texts share one grid cell, so the button keeps the width of the longer
 * one and nothing beside it moves; the text not showing is hidden from sight
 * and from screen readers, and the change is announced. The button dims
 * meanwhile, as a busy `.ad-btn` does (family.css). Must be rendered inside a
 * next/link `<Link>`.
 */
export function OpeningLabel({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className="ad-fp-swap" data-pending={pending || undefined}>
      <span aria-live="polite">{pending ? pendingLabel : label}</span>
      <span aria-hidden="true">{pending ? label : pendingLabel}</span>
    </span>
  );
}
