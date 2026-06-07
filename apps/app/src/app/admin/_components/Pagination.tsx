import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtNumber } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";

/**
 * Server-rendered pagination. Links carry the full query; the chevrons point
 * with the reading direction (RTL: "next" is to the start/left).
 */
export function Pagination({
  page,
  pageCount,
  total,
  baseParams,
  locale,
}: {
  page: number;
  pageCount: number;
  total: number;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  const linkBase =
    "inline-flex h-11 items-center gap-1 rounded-lg border border-brand-ink/15 px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-surface";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-1"
      aria-label={t("nav_pagination", locale)}
    >
      <p
        className="text-sm text-brand-ink-muted"
        role="status"
        aria-live="polite"
      >
        <span dir="ltr" className="tabular-nums">
          {fmtNumber(total, locale)}
        </span>{" "}
        {t("results_count", locale)}
      </p>

      <div className="flex items-center gap-2">
        <Link
          href={buildQuery(baseParams, { page: page - 1 })}
          className={`${linkBase} ${hasPrev ? "" : disabled}`}
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          rel="prev"
        >
          {/* Reading-direction aware: in RTL "previous" points right. */}
          <ChevronRight className="size-4 ltr:hidden" aria-hidden="true" />
          <ChevronLeft className="size-4 rtl:hidden" aria-hidden="true" />
          {t("page_prev", locale)}
        </Link>

        <span
          className="text-sm tabular-nums text-brand-ink-muted"
          dir="ltr"
          aria-label={`${t("page_label", locale)} ${fmtNumber(page, locale)} / ${fmtNumber(pageCount, locale)}`}
        >
          {fmtNumber(page, locale)} / {fmtNumber(pageCount, locale)}
        </span>

        <Link
          href={buildQuery(baseParams, { page: page + 1 })}
          className={`${linkBase} ${hasNext ? "" : disabled}`}
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          rel="next"
        >
          {t("page_next", locale)}
          {/* In RTL "next" points left. */}
          <ChevronLeft className="size-4 ltr:hidden" aria-hidden="true" />
          <ChevronRight className="size-4 rtl:hidden" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
