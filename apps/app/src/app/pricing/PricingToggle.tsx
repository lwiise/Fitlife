"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function PricingToggle({ cadence }: { cadence: "monthly" | "annual" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setCadence(next: "monthly" | "annual") {
    if (next === cadence) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "monthly") {
      params.delete("cadence");
    } else {
      params.set("cadence", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="inline-flex rounded-full bg-white p-1 border border-brand-ink/10 shadow-sm">
      <button
        type="button"
        onClick={() => setCadence("monthly")}
        disabled={isPending}
        aria-pressed={cadence === "monthly"}
        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
          cadence === "monthly"
            ? "bg-brand-ink text-white"
            : "text-brand-ink-muted hover:text-brand-ink"
        }`}
      >
        شهري
      </button>
      <button
        type="button"
        onClick={() => setCadence("annual")}
        disabled={isPending}
        aria-pressed={cadence === "annual"}
        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
          cadence === "annual"
            ? "bg-brand-ink text-white"
            : "text-brand-ink-muted hover:text-brand-ink"
        }`}
      >
        سنوي
        <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-full bg-brand-yellow/30 text-brand-ink text-xs">
          وفّري 20%
        </span>
      </button>
    </div>
  );
}
