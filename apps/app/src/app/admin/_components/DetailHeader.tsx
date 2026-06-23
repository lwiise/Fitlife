import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { LocaleToggle } from "./LocaleToggle";

/** Drill-down chrome: a reading-direction-aware back link + locale toggle, then
 * an identity lockup (initial avatar, name, email) and an optional row of
 * badges/flags. */
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
  const initial =
    (name && name !== "—" ? name : "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="border-b border-brand-ink/5 bg-surface-elevated">
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

        <div className="mt-3 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-lavender/40 text-lg font-extrabold text-brand-purple-900"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <h1 className="adm-h1 text-brand-ink">{name || "—"}</h1>
              {email ? (
                <span dir="ltr" className="adm-body text-brand-ink-muted">
                  {email}
                </span>
              ) : null}
            </div>
            {children ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {children}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
