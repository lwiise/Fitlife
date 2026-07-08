"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";

/**
 * Triggers plan generation from the dashboard's empty / failed state.
 * - Not onboarded → send to /onboarding (never generate before onboarding).
 * - Trial/subscription gate (402) → /pricing.
 * - Other gates (403 medical, 429 rate limit, 5xx) → inline Arabic error.
 */
export function EmptyPlanCTA({
  isOnboarded,
  variant = "empty",
}: {
  isOnboarded: boolean;
  variant?: "empty" | "failed";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isFailed = variant === "failed";
  const label = isFailed ? "إعادة المحاولة" : "إنشاء خطتي";

  function handleClick() {
    if (!isOnboarded) {
      router.push("/onboarding");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plans/generate", { method: "POST" });
        if (res.ok) {
          if (isFailed) router.refresh();
          else router.push("/plan");
          return;
        }
        if (res.status === 402) {
          router.push("/pricing");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          busy?: boolean;
        };
        // Already generating → that IS the goal; show the progress screen.
        if (res.status === 409 || body.busy) {
          router.push("/plan");
          return;
        }
        setError(body.error ?? "حدث خطأ. حاولي مرة ثانية");
      } catch {
        setError("حدث خطأ في الاتصال. حاولي مرة ثانية");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-3 rounded-full bg-brand-purple-900 hover:bg-brand-purple-700 disabled:bg-brand-purple-900/40 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : isFailed ? (
          <RotateCcw className="size-4" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-red-700 text-sm leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
