"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import type { LocaleCode } from "@fitlife/plan-engine";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getPlanActionStrings } from "@/lib/plans/locales";
import { genderPick } from "@/lib/copy/gender";

/**
 * "household" is not a partial scope — it drops the memberId entirely and asks
 * for a fresh week for everyone. It exists because there was NO way to request
 * one: both mounts of this button pass the viewed member's id, and the
 * dashboard's «أنشئي خطة جديدة لأسبوع جديد» is a plain link to /plan. A customer
 * could regenerate people one at a time and never the family.
 */
type RegenScope = "both" | "shared" | "individual" | "household";

export function RegenerateButton({
  className = "",
  memberId,
  memberName,
  hasSharedMeals = false,
  memberCount = 1,
  locale,
  ownerSex,
}: {
  className?: string;
  // Scope the regen to the member being viewed (others kept untouched).
  memberId?: string;
  memberName?: string;
  // When the member shares meals, offer a scope chooser (individual / shared /
  // both). When false, a plain confirm (nothing to scope).
  hasSharedMeals?: boolean;
  // Beneficiaries in the plan. More than one → the household option is a real
  // choice; on a solo plan regenerating the only member IS the household.
  memberCount?: number;
  locale?: LocaleCode;
  // Account owner's sex → owner-directed Arabic copy (the one tapping regen).
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const t = getPlanActionStrings(locale ?? "ar");
  const g = genderPick(ownerSex);
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
            // "household" is the absence of a memberId — the route reads no
            // memberId as a full regen, so it must not send one.
            ...(memberId && scope !== "household" ? { memberId } : {}),
            // Only meaningful when the member has shared meals to scope.
            ...(memberId && hasSharedMeals && scope !== "household" ? { scope } : {}),
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
        // A run is already in flight — usually the automatic drain, which fires
        // on every /plan and /dashboard visit and holds the per-kind lock for
        // the whole run. This used to close the dialog and refresh, so the tap
        // did NOTHING and said nothing: on a household whose week never fills,
        // the drain restarts on every visit and «إنشاء خطة جديدة» simply never
        // worked. Keep the dialog open, say what is happening, and leave the
        // confirm button live so it can be retried the moment the run ends (the
        // page is already polling).
        if (res.status === 409 || body.busy) {
          router.refresh();
          setErrorMessage(
            body.error
              ? `${body.error}. ${g("أعيدي المحاولة بعد أن تنتهي.", "أعِد المحاولة بعد أن تنتهي.")}`
              : g(
                  "خطتك قيد التجهيز الآن. أعيدي المحاولة بعد أن تنتهي.",
                  "خطتك قيد التجهيز الآن. أعِد المحاولة بعد أن تنتهي.",
                ),
          );
          return;
        }
        // Keep the dialog open and surface the error inside it.
        setErrorMessage(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setErrorMessage(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  const householdOption = {
    value: "household" as const,
    label: t.regen_scope_household,
    hint: t.regen_scope_household_hint,
  };
  const scopeOptions: { value: RegenScope; label: string; hint: string }[] = [
    { value: "both", label: t.regen_scope_both, hint: t.regen_scope_both_hint },
    ...(hasSharedMeals
      ? [
          { value: "shared" as const, label: t.regen_scope_shared, hint: t.regen_scope_shared_hint },
          {
            value: "individual" as const,
            label: t.regen_scope_individual,
            hint: t.regen_scope_individual_hint,
          },
        ]
      : []),
    householdOption,
  ];
  // Offer the chooser whenever there is more than one way to answer: with
  // shared meals that is the three per-member scopes plus the household; without
  // them it is just "this member" vs "everyone". A solo plan has neither — the
  // only member IS the household.
  const showScopeChooser = !!memberId && memberCount > 1;
  const household = scope === "household";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openDialog}
        disabled={isPending}
        // Ring offset stays the Tailwind default (white): this button now sits
        // on the plan header's white band and, on a failed day, on a near-white
        // tinted box — never on the page's grey surface.
        className="inline-flex items-center justify-center gap-2 bg-brand-purple-900 hover:bg-brand-purple-700 disabled:bg-brand-purple-900/40 text-white font-bold text-sm px-5 py-2.5 rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 min-h-[2.75rem]"
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
        // The title follows the CHOICE, so a dialog opened from سعود's tab does
        // not still say «لـ سعود» once «البيت كله» is selected.
        title={
          household
            ? "إنشاء خطة جديدة للبيت كله"
            : memberName
              ? `إنشاء خطة جديدة لـ ${memberName}`
              : "إنشاء خطة جديدة"
        }
        body={
          /* فصحى, per the Coach Sara directive: this is questionnaire copy —
             the two fields below feed the plan engine — and it was written in
             عامية («قوليلنا ايش تبين»، «عشان»، «بتنحفظ»). Feminine أنتِ
             address kept. */
          /* «فقط», never «وحدها»: memberName is the VIEWED member, who can be
             the husband or a son, and g() here follows the OWNER's sex — so a
             gendered word about the member would be wrong half the time. */
          memberName && !household
            ? `ننشئ خطة جديدة لـ ${memberName} فقط. خطط بقية الأفراد لا تتغيّر، والخطة الحالية تُحفظ في السجل. ${g("أخبرينا ما الذي تودّين تغييره.", "أخبرنا ما الذي تودّ تغييره.")}`
            : g(
                "لنصمّم لكِ خطة أنسب، أخبرينا ما الذي تودّين تغييره. الخطة الحالية تُحفظ في السجل.",
                "لنصمّم لك خطة أنسب، أخبرنا ما الذي تودّ تغييره. الخطة الحالية تُحفظ في السجل.",
              )
        }
        confirmLabel={g("أنشئي الخطة", "أنشئ الخطة")}
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
          {showScopeChooser && (
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
              {g("ما الذي لم يناسبكِ في الخطة الحالية؟", "ما الذي لم يناسبك في الخطة الحالية؟")} <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: الوجبات متكرّرة، أو لا أحب السمك"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
          <div>
            <label
              htmlFor="regen-improvements"
              className="block text-sm font-bold text-brand-ink mb-1.5"
            >
              {g("ما الذي تودّين تغييره أو تحسينه؟", "ما الذي تودّ تغييره أو تحسينه؟")} <span className="text-brand-ink-muted font-medium">(اختياري)</span>
            </label>
            <textarea
              id="regen-improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="مثلاً: تنوّع أكثر، ووجبات أخفّ للعشاء"
              className="w-full px-3 py-2.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm leading-relaxed placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
