"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { ButtonLink } from "@/components/ui/button";
import { genderPick } from "@/lib/copy/gender";

const STORAGE_KEY = "fitlife.profileEdited";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Shows a transient "saved" confirmation and, after a health/family-prefs edit,
// a sticky nudge to regenerate the plan. The nudge persists across refreshes via
// sessionStorage (max 24h) until the user heads to /plan.
export function ProfileEditedBanner({ ownerSex }: { ownerSex?: string | null }) {
  const params = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    const editedParam = params.get("edited"); // 'health' | 'family' | 'deep-dive'
    const savedParam = params.get("saved"); // '1'

    // The deep-dive answers feed the plan's lifestyle block, so a save there
    // is a plan-affecting edit like health/family — it used to show nothing.
    if (editedParam === "health" || editedParam === "family" || editedParam === "deep-dive") {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs UI from URL params with sessionStorage/replaceState side effects; params stable, no loop
      setShowNudge(true);
      setSaved(true);
    } else if (savedParam === "1") {
      setSaved(true);
    } else {
      const ts = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
      if (ts && Date.now() - ts < MAX_AGE_MS) setShowNudge(true);
      else if (ts) sessionStorage.removeItem(STORAGE_KEY);
    }

    // Strip the query param so a refresh doesn't re-trigger the confirmation.
    if (editedParam || savedParam) {
      window.history.replaceState(null, "", "/profile");
    }
  }, [params]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function clearNudge() {
    sessionStorage.removeItem(STORAGE_KEY);
    setShowNudge(false);
  }

  if (!saved && !showNudge) return null;

  const g = genderPick(ownerSex);
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
          {g(
            "عدّلتِ بياناتك. أنشئي خطة جديدة لتطبيق التعديلات على خطتك.",
            "عدّلت بياناتك. أنشئ خطة جديدة لتطبيق التعديلات على خطتك.",
          )}
        </Notice>
      )}
    </div>
  );
}
