import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * "Back one step" link for inner pages. Points at the page's logical PARENT (`href`)
 * so each click walks one level up the hierarchy toward the dashboard — e.g. a
 * profile edit page → /profile → /settings → /dashboard. Deterministic on purpose:
 * unlike router.back(), it isn't thrown off by post-save redirects or a fresh/
 * deep-linked history (where back() would jump straight to the dashboard).
 * ChevronRight is the RTL-correct "back" arrow (points toward the start in Arabic).
 */
export function BackButton({
  href,
  label = "رجوع",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 min-h-11 px-2.5 sm:px-3 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      <ChevronRight className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
