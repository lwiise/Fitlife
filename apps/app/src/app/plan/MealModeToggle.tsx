"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LocaleCode } from "@fitlife/plan-engine";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getPlanActionStrings } from "@/lib/plans/locales";
import { setMemberMealMode } from "@/app/onboarding/actions";

type MealMode = "shared" | "independent";

/**
 * Per-member shared↔independent toggle on the plan page. Switching persists the
 * member's meal_mode and regenerates only that member (carry-over); anyone who
 * shared meals with them is recomputed server-side via resyncSharedMeals. The
 * switch is confirmed first so the user knows it triggers a regeneration.
 */
export function MealModeToggle({
  memberId,
  memberName,
  currentMode,
  locale,
  className = "",
}: {
  memberId: string;
  memberName: string;
  currentMode: MealMode;
  locale?: LocaleCode;
  className?: string;
}) {
  const router = useRouter();
  const t = getPlanActionStrings(locale ?? "ar");
  const [isPending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<MealMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function requestSwitch(mode: MealMode) {
    if (mode === currentMode || isPending) return;
    setErrorMessage(null);
    setPendingMode(mode);
  }

  function closeDialog() {
    if (isPending) return;
    setPendingMode(null);
    setErrorMessage(null);
  }

  function handleConfirm() {
    if (!pendingMode) return;
    setErrorMessage(null);
    startTransition(async () => {
      const res = await setMemberMealMode(memberId, pendingMode);
      if (res.ok) {
        setPendingMode(null);
        router.refresh();
        return;
      }
      setErrorMessage(
        "upgrade_required" in res
          ? "باقتك لا تكفي لإنشاء خطة جديدة"
          : (res.error ?? "حدث خطأ. حاولي مرة ثانية"),
      );
    });
  }

  const options: { mode: MealMode; label: string }[] = [
    { mode: "shared", label: t.meal_mode_shared },
    { mode: "independent", label: t.meal_mode_independent },
  ];

  return (
    <div className={className}>
      <div
        role="group"
        aria-label={t.meal_mode_label}
        className="inline-flex items-center rounded-full border border-brand-ink/10 bg-white p-1"
      >
        {options.map((opt) => {
          const active = opt.mode === currentMode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => requestSwitch(opt.mode)}
              disabled={isPending}
              aria-pressed={active}
              className={`inline-flex items-center justify-center min-h-11 px-4 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface disabled:cursor-not-allowed ${
                active
                  ? "bg-brand-purple-900 text-white"
                  : "text-brand-ink-muted hover:text-brand-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingMode !== null}
        title={`${t.meal_mode_switch_title} — ${memberName}`}
        body={(pendingMode === "independent"
          ? t.meal_mode_to_independent_body
          : t.meal_mode_to_shared_body
        ).replace("{name}", memberName)}
        confirmLabel={t.meal_mode_confirm}
        isPending={isPending}
        error={errorMessage}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
