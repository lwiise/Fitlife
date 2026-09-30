import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { PreviousPageLink } from "./previous-page-link";

const BACK_LINK =
  "-ms-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] font-bold text-brand-purple-900 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900";

/**
 * Every in-app page's title block: an optional «رجوع» link (sub-pages), the
 * page title in the app scale, an optional one-line description, and an
 * optional action slot on the end side. Replaces the per-page top bars —
 * navigation itself lives in the app shell.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /**
   * `{ href, label }` names a fixed parent — a form returns to the page it
   * edits. `{ fallback }` is a plain «رجوع» to the PREVIOUS page, whatever it
   * was, going to `fallback` only when there is none (see PreviousPageLink).
   */
  back?: { href: string; label: string } | { fallback: string };
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  const backContent = back && (
    <>
      {/* ChevronRight points "back" in RTL. */}
      <ChevronRight className="size-4" aria-hidden="true" />
      {"fallback" in back ? "رجوع" : back.label}
    </>
  );

  return (
    <div className={clsx("mb-6", className)}>
      {back &&
        ("fallback" in back ? (
          <PreviousPageLink href={back.fallback} className={BACK_LINK}>
            {backContent}
          </PreviousPageLink>
        ) : (
          <Link href={back.href} className={BACK_LINK}>
            {backContent}
          </Link>
        ))}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-sm font-bold text-brand-ink-muted">{eyebrow}</p>
          )}
          <h1 className="text-app-title text-brand-ink">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-prose text-base leading-relaxed text-brand-ink-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
