"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const LONG_RUNNING_MS = 90_000;
const TIMEOUT_MS = 780_000;

// Rotating reassurance copy — same presentational pattern as the meal plan's
// generating card so both flows feel identical.
const GENERATING_STEPS = [
  "نختار التقسيم الأسبوعي المناسب",
  "نوزّع الجلسات على أيام أسبوعك",
  "نختار التمارين وبدائلها المنزلية",
  "نضبط المجموعات والتكرارات والراحة",
];

/**
 * Loading state for a workout generation in flight. Mirrors
 * PlanGeneratingState's card (spinner, progress bar, rotating steps,
 * long-running softening, timeout fallback) — polling the workout status
 * route instead of the meal one.
 */
export function WorkoutGeneratingState() {
  const [timedOut, setTimedOut] = useState(false);
  const [isLong, setIsLong] = useState(false);
  const [progress, setProgress] = useState(6);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const progressTimer = setInterval(() => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(
        6,
        Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 45000)))),
      );
      setProgress(pct);
      setStepIndex(Math.floor(elapsed / 4000) % GENERATING_STEPS.length);
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
        const res = await fetch("/api/plans/workout/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (body.status === "ready" || body.status === "failed") {
          clearInterval(poll);
          clearInterval(progressTimer);
          setProgress(100);
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
  }, []);

  if (timedOut) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-brand-ink/5 p-8 text-center">
        <h2 className="font-extrabold text-xl text-brand-ink leading-tight">
          العملية تاخذ وقت أطول من المتوقع
        </h2>
        <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
          حدّثي الصفحة عشان تشيكين إذا البرنامج جاهز، أو حاولي مرة ثانية بعد دقيقة.
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
        نحضّر برنامج التمارين...
      </h2>
      <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
        {isLong
          ? "نجهّز برنامجاً مفصّلاً. يحتاج دقيقة أو دقيقتين إضافية، لا تقفلين الصفحة."
          : "هذي العملية تاخذ من دقيقة إلى دقيقتين. لا تقفلين الصفحة."}
      </p>
      <div
        className="mt-6 h-1.5 bg-brand-surface rounded-full overflow-hidden"
        role="progressbar"
        aria-busy="true"
        aria-label="جاري إنشاء برنامج التمارين"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p
        className="mt-3 text-brand-purple-900 text-xs font-bold leading-relaxed"
        aria-hidden="true"
      >
        {GENERATING_STEPS[stepIndex]}…
      </p>
    </div>
  );
}
