"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import type { LocaleCode, RegenDomain } from "@fitlife/plan-engine";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getPlanActionStrings } from "@/lib/plans/locales";

type RegenScope = "both" | "shared" | "individual";

export function RegenerateButton({
  className = "",
  memberId,
  memberName,
  hasSharedMeals = false,
  canPickDomain = false,
  budgetChanged = false,
  locale,
}: {
  className?: string;
  // Scope the regen to the member being viewed (others kept untouched).
  memberId?: string;
  memberName?: string;
  // When the member shares meals, offer a scope chooser (individual / shared /
  // both). When false, a plain confirm (nothing to scope).
  hasSharedMeals?: boolean;
  // When the member has an exercise plan, offer the DOMAIN chooser (meals only /
  // exercise only / both). The meal-area scope chooser then becomes a sub-question.
  canPickDomain?: boolean;
  // Whether an exercise edit moved this member's calorie math — so picking
  // "exercise only" would auto-promote to "both". Drives the inline promote note.
  // The server re-checks authoritatively; this is a pre-submit preview.
  budgetChanged?: boolean;
  locale?: LocaleCode;
}) {
  const router = useRouter();
  const t = getPlanActionStrings(locale ?? "ar");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [issues, setIssues] = useState("");
  const [improvements, setImprovements] = useState("");
  const [scope, setScope] = useState<RegenScope>("both");
  const [domain, setDomain] = useState<RegenDomain>("both");

  function openDialog() {
    setErrorMessage(null);
    setScope("both");
    setDomain("both");
    setConfirmOpen(true);
  }

  function closeDialog() {
    setConfirmOpen(false);
    setErrorMessage(null);
    setIssues("");
    setImprovements("");
    setScope("both");
    setDomain("both");
  }

  // "exercise only" carries no meal-area scope; meals stay untouched (unless the
  // budget moved, in which case the server auto-promotes to "both").
  const scopePickerShown =
    !!memberId && hasSharedMeals && domain !== "exercise";
  const showPromoteNote = canPickDomain && domain === "exercise" && budgetChanged;

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            issues: issues.trim(),
            improvements: improvements.trim(),
            ...(memberId ? { memberId } : {}),
            // Meal-area scope only when meals are actually regenerating (not
            // exercise-only) and there are shared meals to scope.
            ...(scopePickerShown ? { scope } : {}),
            // Domain only when the member has an exercise plan to choose from.
            ...(canPickDomain && memberId ? { domain } : {}),
          }),
        });
        if (res.ok) {
          closeDialog();
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // Keep the dialog open and surface the error inside it.
        setErrorMessage(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setErrorMessage("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  const scopeOptions: { value: RegenScope; label: string; hint: string }[] = [
    { value: "both", label: t.regen_scope_both, hint: t.regen_scope_both_hint },
    { value: "shared", label: t.regen_scope_shared, hint: t.regen_scope_shared_hint },
    {
      value: "individual",
      label: t.regen_scope_individual,
      hint: t.regen_scope_individual_hint,
    },
  ];

  const domainOptions: { value: RegenDomain; label: string; hint: string }[] = [
    { value: "both", label: t.regen_domain_both, hint: t.regen_domain_both_hint },
    { value: "meals", label: t.regen_domain_meals, hint: t.regen_domain_meals_hint },
    {
      value: "exercise",
      label: t.regen_domain_exercise,
      hint: t.regen_domain_exercise_hint,
    },
  ];

  // One styled radio group — used for both the domain picker and the meal-area
  // scope picker, so they stay visually identical.
  const radioGroup = (
    name: string,
    title: string,
    options: { value: string; label: string; hint: string }[],
    value: string,
    onChange: (v: string) => void,
  ) => (
    <fieldset>
      <legend className="block text-sm font-bold text-brand-ink mb-2">{title}</legend>
      <div className="space-y-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 min-h-11 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                selected
                  ? "border-brand-purple-900 bg-brand-lavender/20"
                  : "border-brand-ink/10 hover:border-brand-ink/20"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                disabled={isPending}
                className="mt-1 size-4 accent-brand-purple-900 flex-shrink-0"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-brand-ink">{opt.label}</span>
                <span className="block text-xs text-brand-ink-muted leading-relaxed mt-0.5">
                  {opt.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openDialog}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-[2.75rem]"
      >
        {isPending ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        إنشاء خطة جديدة
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={memberName ? `إنشاء خطة جديدة لـ ${memberName}` : "إنشاء خطة جديدة"}
        body={
          memberName
            ? `بننشئ خطة جديدة لـ ${memberName} فقط — باقي الأفراد ما تتغيّر خططهم. الخطة الحالية تنحفظ في السجل. قوليلنا ايش تبين نغيّر.`
            : "عشان نصمم لكِ خطة أنسب، قوليلنا ايش تبين نغيّر. الخطة الحالية بتنحفظ في السجل."
        }
        confirmLabel="أنشئي الخطة"
        cancelLabel="إلغاء"
        isPending={isPending}
        error={errorMessage}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          closeDialog();
        }}
      >
        <div className="space-y-4">
          {canPickDomain &&
            radioGroup("regen-domain", t.regen_domain_title, domainOptions, domain, (v) =>
              setDomain(v as RegenDomain),
            )}

          {showPromoteNote && (
            <p className="rounded-xl border border-brand-lavender/60 bg-brand-lavender/20 px-3 py-2.5 text-xs text-brand-ink leading-relaxed">
              {t.regen_domain_promote_note}
            </p>
          )}

          {scopePickerShown &&
            radioGroup(
              "regen-scope",
              canPickDomain ? t.regen_scope_sub_title : t.regen_scope_title,
              scopeOptions,
              scope,
              (v) => setScope(v as RegenScope),
            )}
          <div>
            <label
              htmlFor="regen-issues"
              className="block text-sm font-bold text-brand-ink mb-1.5"
            >
              ايش ما عجبك في الخطة الحالية؟ <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: الوجبات متكررة، أو ما أحب السمك"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="regen-improvements"
              className="block text-sm font-bold text-brand-ink mb-1.5"
            >
              ايش تحبين نغيّر أو نحسّن؟ <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: تنوع أكثر، وجبات أخف للعشاء"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
