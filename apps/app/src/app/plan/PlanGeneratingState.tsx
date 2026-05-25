"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
// Generation runs one concurrent Anthropic call per family member; the slowest
// member can take ~2-3 min. After this we soften the copy (but keep waiting) so
// a normal run never looks broken.
const LONG_RUNNING_MS = 90_000;
// Genuine-stuck threshold — only past this do we show the refresh/retry
// fallback. Kept inside the background function's 15-min budget.
const TIMEOUT_MS = 780_000;

export function PlanGeneratingState({
  planId,
  solo = false,
}: {
  planId: string;
  solo?: boolean;
}) {
  const [timedOut, setTimedOut] = useState(false);
  const [isLong, setIsLong] = useState(false);
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    // Time-based progress estimate (no real signal from the bg function): ease
    // toward ~95% over the expected window, then snap to 100% on completion.
    const progressTimer = setInterval(() => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(
        6,
        Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 45000)))),
      );
      setProgress(pct);
    }, 1000);

    const poll = setInterval(async () => {
      if (cancelled) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed > TIMEOUT_MS) {
        clearInterval(poll);
        clearInterval(progressTimer);
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
          clearInterval(poll);
          clearInterval(progressTimer);
          setProgress(100);
          // Let the bar visibly complete, then hard-reload (a fresh server
          // render guarantees the plan/failed state shows automatically).
          setTimeout(() => window.location.reload(), 500);
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(progressTimer);
    };
  }, [planId]);

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
          onClick={() => window.location.reload()}
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
          ? solo
            ? "نجهّز خطتك المفصّلة. تحتاج دقيقة أو دقيقتين إضافية، لا تقفلين الصفحة."
            : "نجهّز خطة مفصلة لكل فرد بالعائلة. تحتاج دقيقة أو دقيقتين إضافية، لا تقفلين الصفحة."
          : "هذي العملية تاخذ من دقيقة إلى دقيقتين. لا تقفلين الصفحة."}
      </p>
      <div
        className="mt-6 h-1.5 bg-brand-surface rounded-full overflow-hidden"
        role="progressbar"
        aria-busy="true"
        aria-label="جاري إنشاء الخطة"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
