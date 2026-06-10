"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

/**
 * "Back one step" control for inner pages (settings + the profile edit pages).
 * Uses router.back() so it returns to wherever the user came from; falls back to
 * `fallbackHref` when there's no in-app history (e.g. a direct/bookmarked link).
 * ChevronRight is the RTL-correct "back" arrow (points toward the start in Arabic).
 */
export function BackButton({
  fallbackHref = "/dashboard",
  label = "رجوع",
  className = "",
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-2.5 sm:px-3 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      <ChevronRight className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
