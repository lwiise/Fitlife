"use client";

import { Share2 } from "lucide-react";
import { buildShareText } from "@/lib/engagement/shareText";

/**
 * WhatsApp share of the week — positives only BY CONSTRUCTION: this component
 * can only ever receive the two public counts (see buildShareText, which has
 * no parameter through which weight/skips/member data could pass).
 */
export function ShareWeekButton({
  cookedDays,
  guestDays,
}: {
  cookedDays: number;
  guestDays: number;
}) {
  const text = buildShareText({ cooked_days: cookedDays, guest_days: guestDays });
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      <Share2 className="size-4" aria-hidden="true" />
      شاركي أسبوعك
      <span className="sr-only">(يفتح واتساب في نافذة جديدة)</span>
    </a>
  );
}
