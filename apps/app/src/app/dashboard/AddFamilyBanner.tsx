"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, X } from "lucide-react";

const KEY = "fitlife.addFamilyBanner.dismissed";

/**
 * Once-per-session nudge to add family members, shown after Mom's plan is ready
 * but no other members exist. Respects the user's choice not to add anyone —
 * dismissal persists for the session.
 */
export function AddFamilyBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY) !== "1") setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(KEY, "1");
    setVisible(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/25 px-4 py-3 mb-6">
      <Users className="size-5 flex-shrink-0 mt-0.5 text-brand-purple-900" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-brand-ink text-sm font-medium leading-relaxed">
          خطتك جاهزة. تبين تضيفين فرد ثاني من عائلتك للحصول على وجبات منسقة؟
        </p>
        <Link
          href="/family"
          className="inline-flex items-center mt-2 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
        >
          إضافة فرد
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء"
        className="flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full hover:bg-brand-purple-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        <X className="size-4 text-brand-ink-muted" aria-hidden="true" />
      </button>
    </div>
  );
}
