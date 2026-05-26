import Link from "next/link";
import { Settings } from "lucide-react";

/**
 * Persistent link to the account settings page for authenticated inner pages.
 */
export function SettingsLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/settings"
      aria-label="الإعدادات"
      className={`inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-brand-ink-muted hover:text-brand-ink hover:bg-brand-surface text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      <Settings className="size-4" aria-hidden="true" />
      الإعدادات
    </Link>
  );
}
