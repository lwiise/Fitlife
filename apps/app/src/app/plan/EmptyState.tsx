"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function EmptyState({ isOnboarded }: { isOnboarded: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setErrorMessage("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  if (!isOnboarded) {
    return (
      <div className="text-center max-w-md mx-auto py-12">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-purple-900/10 mb-6">
          <Sparkles className="size-7 text-brand-purple-900" aria-hidden="true" />
        </div>
        <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
          أكملي بياناتك أولاً
        </h2>
        <p className="mt-3 text-brand-ink-muted text-base leading-relaxed">
          نحتاج بعض المعلومات عشان نحضّر لكِ خطة على مقاسك.
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

  return (
    <div className="text-center max-w-md mx-auto py-12">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-yellow/20 mb-6">
        <Sparkles className="size-7 text-brand-yellow" aria-hidden="true" />
      </div>
      <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
        جاهزة لخطتك الأولى
      </h2>
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
