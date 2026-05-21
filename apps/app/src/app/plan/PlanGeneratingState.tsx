"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
// Generation runs one concurrent Anthropic call per family member; the slowest
// member can take ~2-3 min. After this we soften the copy (but keep waiting) so
// a normal run never looks broken.
const LONG_RUNNING_MS = 90_000;
// Genuine-stuck threshold — only past this do we show the refresh/retry
// fallback. Kept inside the background function's 15-min budget.
const TIMEOUT_MS = 780_000;

export function PlanGeneratingState({ planId }: { planId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [isLong, setIsLong] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const interval = setInterval(async () => {
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed > TIMEOUT_MS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }
      if (elapsed >= LONG_RUNNING_MS) {
        setIsLong(true);
      }

      try {
        const res = await fetch("/api/plans/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { id: string; status: string };
        if (body.id !== planId) return;
        if (body.status === "ready" || body.status === "failed") {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [planId, router]);

  if (timedOut) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-brand-ink/5 p-8 text-center">
        <h2 className="font-extrabold text-xl text-brand-ink leading-tight">
          العملية تاخذ وقت أطول من المتوقع
        </h2>
        <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
          حدّثي الصفحة عشان تشيكين إذا الخطة جاهزة، أو حاولي مرة ثانية بعد دقيقة.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-6 inline-flex items-center justify-center w-full bg-brand-ink hover:bg-brand-purple-900 text-white font-bold py-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          تحديث
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl border border-brand-ink/5 p-8 text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-brand-purple-900/10 mb-4">
        <Loader2
          className="size-8 text-brand-purple-900 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      </div>
      <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
        نحضّر خطتك...
      </h2>
      <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
        {isLong
          ? "نجهّز خطة مفصلة لكل فرد بالعائلة. تحتاج دقيقة أو دقيقتين إضافية، لا تقفلين الصفحة."
          : "هذي العملية تاخذ من دقيقة إلى دقيقتين. لا تقفلين الصفحة."}
      </p>
      <div
        className="mt-6 h-1.5 bg-brand-surface rounded-full overflow-hidden"
        role="progressbar"
        aria-busy="true"
        aria-label="جاري إنشاء الخطة"
      >
        <div className="h-full w-1/3 bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow animate-pulse motion-reduce:animate-none" />
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-5 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded"
        >
          جاهزة؟ حدّثي الصفحة
        </button>
      )}
    </div>
  );
}
