"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

export function PlanFailedState({ planId: _planId }: { planId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRetry() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", { method: "POST" });
        if (res.ok) {
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

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl border border-brand-ink/5 p-8 text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-warm-orange/15 mb-4">
        <AlertCircle
          className="size-8 text-brand-warm-orange"
          aria-hidden="true"
        />
      </div>
      <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
        ما قدرنا ننشئ خطتك
      </h2>
      <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
        صار خطأ غير متوقع. حاولي مرة ثانية، وإذا تكرر تواصلي معنا.
      </p>

      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-4 text-red-600 text-sm leading-relaxed"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleRetry}
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold py-3 rounded-xl transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          {isPending && (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          إعادة المحاولة
        </button>
        <a
          href="/dashboard"
          className="flex-1 inline-flex items-center justify-center bg-brand-surface hover:bg-brand-ink/5 text-brand-ink font-bold py-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          ارجعي للوحة
        </a>
      </div>
    </div>
  );
}
