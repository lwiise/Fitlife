"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import type { LocaleCode } from "@fitlife/plan-engine";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getPlanActionStrings } from "@/lib/plans/locales";

type RegenScope = "both" | "shared" | "individual";

export function RegenerateButton({
  className = "",
  memberId,
  memberName,
  hasSharedMeals = false,
  locale,
}: {
  className?: string;
  // Scope the regen to the member being viewed (others kept untouched).
  memberId?: string;
  memberName?: string;
  // When the member shares meals, offer a scope chooser (individual / shared /
  // both). When false, a plain confirm (nothing to scope).
  hasSharedMeals?: boolean;
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

  function openDialog() {
    setErrorMessage(null);
    setScope("both");
    setConfirmOpen(true);
  }

  function closeDialog() {
    setConfirmOpen(false);
    setErrorMessage(null);
    setIssues("");
    setImprovements("");
    setScope("both");
  }

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
            // Only meaningful when the member has shared meals to scope.
            ...(memberId && hasSharedMeals ? { scope } : {}),
          }),
        });
        if (res.ok) {
          closeDialog();
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          busy?: boolean;
        };
        // Already generating → nothing to fix; close and let the page show it.
        if (res.status === 409 || body.busy) {
          closeDialog();
          router.refresh();
          return;
        }
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
          {memberId && hasSharedMeals && (
            <fieldset>
              <legend className="block text-sm font-bold text-brand-ink mb-2">
                {t.regen_scope_title}
              </legend>
              <div className="space-y-2">
                {scopeOptions.map((opt) => {
                  const selected = scope === opt.value;
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
                        name="regen-scope"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setScope(opt.value)}
                        disabled={isPending}
                        className="mt-1 size-4 accent-brand-purple-900 flex-shrink-0"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-brand-ink">
                          {opt.label}
                        </span>
                        <span className="block text-xs text-brand-ink-muted leading-relaxed mt-0.5">
                          {opt.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
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
