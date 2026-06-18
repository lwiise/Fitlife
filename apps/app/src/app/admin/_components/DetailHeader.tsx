import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { LocaleToggle } from "./LocaleToggle";

/** Drill-down chrome: a reading-direction-aware back link, the subject's name
 * + email, an optional row of badges/flags, and the ar/en toggle. */
export function DetailHeader({
  backHref,
  backLabel,
  name,
  email,
  locale,
  localeNext,
  children,
}: {
  backHref: string;
  backLabel: string;
  name: string;
  email?: string | null;
  locale: AdminLocale;
  localeNext: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-brand-purple-900/10 bg-gradient-to-b from-surface-elevated to-admin-surface">
      <div className="container-app py-4">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1 text-sm text-brand-ink-muted hover:text-brand-ink"
          >
            <ChevronRight className="size-4 ltr:hidden" aria-hidden="true" />
            <ChevronLeft className="size-4 rtl:hidden" aria-hidden="true" />
            {backLabel}
          </Link>
          <div className="ms-auto">
            <LocaleToggle locale={locale} next={localeNext} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-extrabold text-brand-ink">{name || "—"}</h1>
          {email ? (
            <span dir="ltr" className="text-sm text-brand-ink-muted">
              {email}
            </span>
          ) : null}
        </div>
        {children ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
