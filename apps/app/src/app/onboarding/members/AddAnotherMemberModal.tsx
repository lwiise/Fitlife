"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { AddMemberPicker } from "@/app/family/AddMemberPicker";
import { finishOnboardingAndGenerate } from "@/app/onboarding/actions";

/**
 * The repeating "add another member?" pop-up of the onboarding loop. It's open on
 * mount with no dismiss — the only ways out are: pick a member type (→ the add
 * wizard, which returns here so this pop-up shows again) or "create my plan",
 * which finalizes onboarding and generates the WHOLE family at once.
 */
export function AddAnotherMemberModal() {
  const [isPending, startTransition] = useTransition();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-another-title"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl">
        <header className="space-y-2">
          <h2
            id="add-another-title"
            className="font-extrabold text-2xl text-brand-ink leading-tight"
          >
            هل تريدين إضافة فرد آخر؟
          </h2>
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            كل فرد يحصل على خطته، والوجبات المشتركة تُطبخ مرة واحدة للجميع.
          </p>
        </header>

        <AddMemberPicker />

        <button
          type="button"
          onClick={() => startTransition(() => finishOnboardingAndGenerate())}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 min-h-11 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          {isPending && (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          جاهزة — أنشئي خطة عائلتي
        </button>
      </div>
    </div>
  );
}
