"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Stethoscope } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { confirmDoctorConsult } from "./actions";

export function EmptyState({
  isOnboarded,
  ownerSex,
  /** The generation gate is refusing a plan until she confirms the consult.
   * Without this the page showed a create button that could only ever fail. */
  needsDoctorSignOff = false,
}: {
  isOnboarded: boolean;
  ownerSex?: string | null;
  needsDoctorSignOff?: boolean;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  function handleConfirmDoctor() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await confirmDoctorConsult();
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCreate() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", { method: "POST" });
        if (res.ok) {
          router.push("/plan");
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          gate?: string;
        };
        // Blocked pending the doctor confirmation → re-render so this page
        // shows the confirmation card instead of the create button.
        if (body.gate === "medical") {
          router.refresh();
          return;
        }
        setErrorMessage(body.error ?? g("حدث خطأ. حاولي مرة ثانية", "حدث خطأ. حاول مرة ثانية"));
      } catch {
        setErrorMessage(g("حدث خطأ في الاتصال. حاولي مرة ثانية", "حدث خطأ في الاتصال. حاول مرة ثانية"));
      }
    });
  }

  if (!isOnboarded) {
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-purple-900/10 mb-6">
          <Sparkles className="size-7 text-brand-purple-900" aria-hidden="true" />
        </div>
        <h1 className="font-extrabold text-2xl text-brand-ink leading-tight">
          {g("أكملي بياناتك أولاً", "أكمل بياناتك أولاً")}
        </h1>
        <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
          {g(
            "نحتاج بعض المعلومات عشان نحضّر لكِ خطة على مقاسك.",
            "نحتاج بعض المعلومات عشان نحضّر لك خطة على مقاسك.",
          )}
        </p>
        <a
          href="/onboarding"
          className="mt-6 inline-flex items-center justify-center w-full max-w-xs bg-brand-ink hover:bg-brand-purple-900 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          إكمال البيانات
        </a>
      </div>
    );
  }

  // Blocked by the medical gate: offer the confirmation right here instead of a
  // create button that returns "استشيري الطبيب" every time she taps it.
  if (needsDoctorSignOff) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-lavender/40 mb-6">
            <Stethoscope
              className="size-7 text-brand-purple-900"
              aria-hidden="true"
            />
          </div>
          <h1 className="font-extrabold text-2xl text-brand-ink leading-tight">
            خطوة واحدة قبل خطتك
          </h1>
          <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
            {g(
              "بسبب حالتك، نتأكد من استشارة الطبيب قبل بناء الخطة. هذا يحمي صحتك ويجعل الخطة مبنية على وضعك الفعلي.",
              "بسبب حالتك، نتأكد من استشارة الطبيب قبل بناء الخطة. هذا يحمي صحتك ويجعل الخطة مبنية على وضعك الفعلي.",
            )}
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 p-4 cursor-pointer text-start">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-1 size-5 rounded accent-brand-purple-900"
          />
          <span className="text-brand-ink text-sm leading-relaxed font-medium">
            {g(
              "أؤكد أنني استشرت طبيبي قبل البدء بالخطة",
              "أؤكد أنني استشرت طبيبي قبل البدء بالخطة",
            )}
          </span>
        </label>

        <button
          type="button"
          onClick={handleConfirmDoctor}
          disabled={isPending || !consented}
          className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          {isPending && (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {g("تابعي", "تابع")}
        </button>

        <a
          href="/profile/health"
          className="mt-3 block text-center text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 min-h-11 py-3"
        >
          {g("تعديل معلوماتي الصحية", "تعديل معلوماتي الصحية")}
        </a>

        {errorMessage && (
          <p
            role="alert"
            aria-live="polite"
            className="mt-4 text-center text-red-600 text-sm leading-relaxed"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-center max-w-md mx-auto py-12">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-yellow/20 mb-6">
        <Sparkles className="size-7 text-brand-yellow" aria-hidden="true" />
      </div>
      <h1 className="font-extrabold text-2xl text-brand-ink leading-tight">
        {g("جاهزة لخطتك الأولى", "جاهز لخطتك الأولى")}
      </h1>
      <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
        خطة غذائية أسبوعية لكل أفراد العائلة، مصممة على مقاسكم.
      </p>
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending}
        className="mt-6 inline-flex items-center justify-center gap-2 w-full max-w-xs bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        إنشاء خطتي
      </button>
      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-4 text-red-600 text-sm leading-relaxed"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
