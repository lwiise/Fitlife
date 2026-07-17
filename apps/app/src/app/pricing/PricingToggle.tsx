"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

/**
 * Billing-cadence segmented control. Two equal halves, one clear selection.
 *
 * The cadence is ALWAYS written explicitly to the URL — an earlier version
 * deleted the param for "monthly" (the old default), which silently broke the
 * monthly button when the page default flipped to annual-first.
 *
 * Brown treatment per founder direction (07/2026) — a deliberate exception to
 * the core palette, using a deep coffee tone that sits well with the gold
 * badge: active #5C4033, hover #4A332A.
 */
export function PricingToggle({ cadence }: { cadence: "monthly" | "annual" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setCadence(next: "monthly" | "annual") {
    if (next === cadence) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("cadence", next);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const base =
    "flex-1 min-h-12 px-6 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C4033] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-70";
  const active = "bg-[#5C4033] text-white shadow-sm";
  const inactive = "text-brand-ink-muted hover:text-[#5C4033] hover:bg-[#5C4033]/10";

  return (
    <div
      role="group"
      aria-label="مدة الفوترة"
      className="inline-flex w-full max-w-xs rounded-full bg-white p-1.5 border border-[#5C4033]/25 shadow-sm"
    >
      <button
        type="button"
        onClick={() => setCadence("monthly")}
        disabled={isPending}
        aria-pressed={cadence === "monthly"}
        className={`${base} ${cadence === "monthly" ? active : inactive}`}
      >
        شهري
      </button>
      <button
        type="button"
        onClick={() => setCadence("annual")}
        disabled={isPending}
        aria-pressed={cadence === "annual"}
        className={`${base} ${cadence === "annual" ? active : inactive}`}
      >
        سنوي
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
            cadence === "annual"
              ? "bg-brand-yellow text-brand-ink"
              : "bg-brand-yellow/25 text-[#5C4033]"
          }`}
        >
          وفّري 20%
        </span>
      </button>
    </div>
  );
}
