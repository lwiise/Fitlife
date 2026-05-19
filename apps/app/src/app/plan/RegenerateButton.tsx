"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function RegenerateButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      "بتنشأ خطة جديدة. الخطة الحالية بتنحفظ في السجل. تأكدين؟",
    );
    if (!confirmed) return;

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
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
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
      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-red-600 text-xs leading-relaxed"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
