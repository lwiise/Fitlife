"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { ButtonLink } from "@/components/ui/button";
import { genderPick } from "@/lib/copy/gender";

const STORAGE_PREFIX = "fitlife.memberEdited.";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Mirrors ProfileEditedBanner for the member hub: a transient "saved" toast and,
// after a substantive edit, a sticky nudge to regenerate the plan (member edits
// apply at the next generation, not in place). The nudge persists across
// refreshes via sessionStorage (max 24h) until the user heads to /plan.
export function MemberEditedBanner({
  memberId,
  ownerSex,
}: {
  memberId: string;
  ownerSex?: string | null;
}) {
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

  if (!saved && !showNudge) return null;

  return (
    <div className="space-y-3">
      {saved && <Notice tone="success" title="تم الحفظ" />}

      {showNudge && (
        <Notice
          tone="info"
          action={
            <ButtonLink href="/plan" onClick={clearNudge}>
              إنشاء خطة جديدة
            </ButtonLink>
          }
        >
          {genderPick(ownerSex)(
            "عدّلتِ البيانات. أنشئي خطة جديدة لتطبيق التعديلات على الخطة.",
            "عدّلت البيانات. أنشئ خطة جديدة لتطبيق التعديلات على الخطة.",
          )}
        </Notice>
      )}
    </div>
  );
}
