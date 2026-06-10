"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import { addHousekeeper } from "@/app/onboarding/actions";
import { LOCALE_CODES_ORDERED, LOCALE_INFO } from "@/lib/plans/locales";

export function HousekeeperForm({
  onboarding = false,
  onComplete,
  initial,
  editing = false,
}: {
  onboarding?: boolean;
  // When provided (the onboarding family builder), called after the maid is saved
  // instead of navigating — lets the parent finish the sequence and generate.
  onComplete?: () => void;
  // Edit mode: prefill the maid's existing name + reading language.
  initial?: { name?: string; preferred_language?: string };
  editing?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [lang, setLang] = useState(initial?.preferred_language ?? "tl");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addHousekeeper({ name: name.trim(), preferred_language: lang });
      if (!result.ok) return setError(result.error);
      // Driven by a parent sequence (onboarding family builder) → hand control back.
      if (onComplete) {
        onComplete();
        return;
      }
      // Onboarding loop: return to the add-another-member pop-up (her translation
      // runs after the family is generated at the end of the loop).
      if (onboarding) {
        router.push("/onboarding/members");
        return;
      }
      if (editing) {
        router.push("/family");
        return;
      }
      router.push(lang === "ar" ? "/plan" : "/plan/housekeeper");
    });
  };

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <h1 className="font-bold text-base text-brand-ink">
            {editing ? "تعديل الخدامة" : "إضافة خدامة"}
          </h1>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
            الخدامة اللي تطبخ للعائلة
          </h2>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            بنجهّز لها تعليمات الطبخ بلغتها. هي تنفّذ الوصفات وليست فرداً في الخطة.
          </p>
        </header>

        <div>
          <label htmlFor="hk-name" className="block text-sm font-bold text-brand-ink mb-2">
            الاسم (اختياري)
          </label>
          <input
            id="hk-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            placeholder="مثلاً: روزا"
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          />
        </div>

        <div>
          <label htmlFor="hk-lang" className="block text-sm font-bold text-brand-ink mb-2">
            بأي لغة تقرأ الخدامة الوصفات؟
          </label>
          <select
            id="hk-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={isPending}
            className="w-full min-h-11 px-4 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            {LOCALE_CODES_ORDERED.map((code) => {
              const info = LOCALE_INFO[code];
              return (
                <option key={code} value={code}>
                  {code === "ar" ? info.native_name : `${info.ar_name} (${info.native_name})`}
                </option>
              );
            })}
          </select>
          <p className="mt-2 text-brand-ink-muted text-xs leading-relaxed">
            بنترجم خطتك الحالية للغتها — بدون إعادة إنشاء الخطة.
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          {isPending && (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          {isPending ? "جاري التجهيز…" : editing ? "حفظ التعديلات" : "إضافة الخدامة"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/family")}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
          رجوع
        </button>
      </div>
    </main>
  );
}
