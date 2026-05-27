import Link from "next/link";
import { LayoutGrid } from "lucide-react";

/**
 * Persistent "back to the main dashboard" control for authenticated inner
 * pages (plan, family, pricing, member wizards). Uses a neutral dashboard
 * icon rather than a directional arrow so it reads unambiguously in RTL.
 */
export function BackToDashboard({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      aria-label="لوحة التحكم"
      className={`inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 sm:min-w-0 px-2.5 sm:px-3 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      <LayoutGrid className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">لوحة التحكم</span>
    </Link>
  );
}
