"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

const STORAGE_PREFIX = "fitlife.memberEdited.";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Mirrors ProfileEditedBanner for the member hub: a transient "saved" toast and,
// after a substantive edit, a sticky nudge to regenerate the plan (member edits
// apply at the next generation, not in place). The nudge persists across
// refreshes via sessionStorage (max 24h) until the user heads to /plan.
export function MemberEditedBanner({ memberId }: { memberId: string }) {
  const params = useSearchParams();
  const storageKey = STORAGE_PREFIX + memberId;
  const [saved, setSaved] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    const editedParam = params.get("edited"); // 'personal' | 'health'
    const savedParam = params.get("saved"); // '1'

    if (editedParam === "personal" || editedParam === "health") {
      sessionStorage.setItem(storageKey, String(Date.now()));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs UI from URL params with sessionStorage/replaceState side effects; params stable, no loop
      setShowNudge(true);
      setSaved(true);
    } else if (savedParam === "1") {
      setSaved(true);
    } else {
      const ts = Number(sessionStorage.getItem(storageKey) ?? 0);
      if (ts && Date.now() - ts < MAX_AGE_MS) setShowNudge(true);
      else if (ts) sessionStorage.removeItem(storageKey);
    }

    // Strip the query param so a refresh doesn't re-trigger the confirmation.
    if (editedParam || savedParam) {
      window.history.replaceState(null, "", `/family/edit/${memberId}`);
    }
  }, [params, memberId, storageKey]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function clearNudge() {
    sessionStorage.removeItem(storageKey);
    setShowNudge(false);
  }

  return (
    <div className="space-y-3">
      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-2xl border border-brand-emerald/30 bg-brand-emerald/10 px-4 py-3 transition-opacity"
        >
          <CheckCircle2 className="size-5 text-brand-emerald flex-shrink-0" aria-hidden="true" />
          <p className="text-brand-emerald text-sm font-bold">تم الحفظ</p>
        </div>
      )}

      {showNudge && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-brand-lavender/60 bg-brand-lavender/20 px-4 py-3">
          <Sparkles className="size-5 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
          <p className="flex-1 text-brand-ink text-sm leading-relaxed">
            عدّلتِ البيانات. أنشئي خطة جديدة لتطبيق التعديلات على الخطة
          </p>
          <Link
            href={`/plan?member=${encodeURIComponent(memberId)}&regen=1`}
            onClick={clearNudge}
            className="inline-flex items-center justify-center min-h-11 px-4 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            إنشاء خطة جديدة
          </Link>
        </div>
      )}
    </div>
  );
}
