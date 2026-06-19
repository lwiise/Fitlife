import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Sparkles,
  UserCog,
  AlertTriangle,
} from "lucide-react";
import type { SubscriberListResult, SubscriberSortKey } from "@/lib/admin/types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { fmtDate, fmtMoney, fmtNumber, fmtRelative } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { StatusBadge } from "./StatusBadge";
import { TierBadge } from "./TierBadge";
import { buildQuery } from "./searchParams";

interface SortState {
  sort: SubscriberSortKey;
  dir: "asc" | "desc";
}

export function SubscriberTable({
  result,
  baseParams,
  sortState,
  currency,
  locale,
}: {
  result: SubscriberListResult;
  baseParams: Record<string, string>;
  sortState: SortState;
  currency: Currency;
  locale: AdminLocale;
}) {
  const th =
    "whitespace-nowrap px-3 py-2.5 adm-label uppercase text-brand-ink/70";
  // Frozen first column: an OPAQUE per-row-parity bg occludes content scrolling
  // beneath it (zebra-aware); the header corner sits above the body sticky cells.
  const stickyHead = "sticky start-0 z-30 bg-surface-elevated";
  const stickyBase = "sticky start-0 z-10 group-hover:bg-brand-purple-900/[0.06]";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-brand-ink/10 bg-surface-elevated">
        <table
          className="w-full min-w-[60rem] border-collapse text-start"
          aria-labelledby="admin-subscribers-heading"
        >
          <thead className="sticky top-0 z-20 bg-surface-elevated shadow-[0_1px_0_rgba(26,16,35,0.08)]">
            <tr className="text-start">
              <SortHeader
                label={t("col_name", locale)}
                sortKey="displayName"
                defaultDir="asc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} ${stickyHead} text-start`}
              />
              <th scope="col" className={`${th} text-start`}>
                {t("col_tier", locale)}
              </th>
              <SortHeader
                label={t("col_status", locale)}
                sortKey="status"
                defaultDir="asc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-start`}
              />
              <SortHeader
                label={t("col_signup", locale)}
                sortKey="signupAt"
                defaultDir="desc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-start`}
              />
              <th scope="col" className={`${th} text-start`}>
                {t("col_renewal", locale)}
              </th>
              <SortHeader
                label={t("col_household", locale)}
                sortKey="beneficiaries"
                defaultDir="desc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-end`}
                align="end"
              />
              <SortHeader
                label={t("col_plans", locale)}
                sortKey="plansGenerated"
                defaultDir="desc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-end`}
                align="end"
              />
              <SortHeader
                label={t("col_activity", locale)}
                sortKey="lastActivityAt"
                defaultDir="desc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-start`}
              />
              <SortHeader
                label={t("col_ai_cost", locale)}
                sortKey="lifetimeAiCostUsd"
                defaultDir="desc"
                sortState={sortState}
                baseParams={baseParams}
                className={`${th} text-end`}
                align="end"
              />
              <th scope="col" className={`${th} w-10`}>
                <span className="sr-only">{t("view_subscriber", locale)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-16 text-center text-sm text-brand-ink-muted"
                >
                  {t("table_no_match", locale)}
                </td>
              </tr>
            ) : (
              result.rows.map((r, i) => {
                const href = `/admin/subscribers/${r.userId}`;
                // Zebra: odd rows get a lavender tint; even rows stay white. The
                // frozen first cell must use the SAME opaque parity bg to occlude.
                const zebra = i % 2 === 1;
                const rowTint = zebra ? "bg-admin-surface" : "bg-surface-elevated";
                return (
                  <tr
                    key={r.userId}
                    className={`group border-t border-brand-ink/10 align-middle transition-colors hover:bg-brand-purple-900/[0.06] ${
                      zebra ? "bg-admin-surface" : ""
                    }`}
                  >
                    {/* Name + email — frozen first column, links to the drill-down */}
                    <td className={`${stickyBase} ${rowTint} px-3 py-2.5`}>
                      <Link href={href} className="group/name flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-medium text-brand-ink group-hover/name:text-brand-purple-900">
                          {r.displayName || "—"}
                          {!r.onboardingComplete ? (
                            <>
                              <AlertTriangle
                                className="size-3.5 text-brand-warm-orange"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                {t("flag_onboarding_incomplete", locale)}
                              </span>
                            </>
                          ) : null}
                        </span>
                        <span dir="ltr" className="text-xs text-brand-ink/70">
                          {r.email || "—"}
                        </span>
                      </Link>
                    </td>

                    <td className="px-3 py-2.5">
                      <TierBadge tier={r.tier} locale={locale} />
                    </td>

                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} locale={locale} />
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink/70">
                      {fmtDate(r.signupAt, locale)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink/70">
                      {fmtDate(
                        r.status === "trialing" ? r.trialEndsAt : r.currentPeriodEnd,
                        locale,
                      )}
                      {r.cancelAtPeriodEnd ? (
                        <span className="ms-1.5 text-xs text-red-700">
                          · {t("cancel_scheduled", locale)}
                        </span>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-end">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span dir="ltr" className="tabular-nums text-brand-ink">
                          {fmtNumber(r.beneficiaries, locale)}
                        </span>
                        {r.hasHousekeeper ? (
                          <>
                            <UserCog
                              className="size-3.5 text-brand-ink-muted"
                              aria-hidden="true"
                            />
                            <span className="sr-only">
                              {t("flag_housekeeper", locale)}
                            </span>
                          </>
                        ) : null}
                        {r.overLimit ? (
                          <span className="rounded bg-red-600/10 px-1 text-[0.65rem] font-semibold text-red-700">
                            <span aria-hidden="true">!</span>
                            <span className="sr-only">{t("flag_over_limit", locale)}</span>
                          </span>
                        ) : null}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-end">
                      {r.plansGenerated > 0 ? (
                        <span dir="ltr" className="tabular-nums text-brand-ink">
                          {fmtNumber(r.plansGenerated, locale)}
                        </span>
                      ) : (
                        <span className="text-brand-ink/40">{fmtNumber(0, locale)}</span>
                      )}
                      {r.failedPlans > 0 ? (
                        <span dir="ltr" className="ms-1 text-xs text-red-700">
                          <span aria-hidden="true">
                            · {fmtNumber(r.failedPlans, locale)}
                          </span>
                          <span className="sr-only">
                            {`${fmtNumber(r.failedPlans, locale)} ${t("failed_plans", locale)}`}
                          </span>
                        </span>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink/70">
                      {r.lastActivityAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="size-3 opacity-50" aria-hidden="true" />
                          {fmtRelative(r.lastActivityAt, locale)}
                        </span>
                      ) : (
                        <span className="text-brand-ink/40">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-end">
                      {r.lifetimeAiCostUsd > 0 ? (
                        <span dir="ltr" className="tabular-nums text-brand-ink">
                          {fmtMoney(r.lifetimeAiCostUsd, currency, locale, 2)}
                        </span>
                      ) : (
                        <span className="text-brand-ink/40">—</span>
                      )}
                    </td>

                    <td className="px-2 py-2.5 text-end">
                      <Link
                        href={href}
                        aria-label={`${t("view_subscriber", locale)}: ${r.displayName || r.email || ""}`}
                        className="inline-flex size-11 items-center justify-center rounded-lg text-brand-ink-muted transition-colors hover:bg-brand-surface hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple-900"
                      >
                        <ChevronRight
                          className="size-4 rtl:rotate-180"
                          aria-hidden="true"
                        />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend for the table's compact glyphs */}
      {result.rows.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-brand-ink/70">
          <li className="font-semibold text-brand-ink-muted">
            {t("table_legend_label", locale)}:
          </li>
          <li className="inline-flex items-center gap-1.5">
            <UserCog className="size-3.5 text-brand-ink-muted" aria-hidden="true" />
            {t("flag_housekeeper", locale)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="rounded bg-red-600/10 px-1 text-[0.65rem] font-semibold text-red-700">
              !
            </span>
            {t("flag_over_limit", locale)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span dir="ltr" className="text-red-700">
              · {fmtNumber(1, locale)}
            </span>
            {t("failed_plans", locale)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <AlertTriangle
              className="size-3.5 text-brand-warm-orange"
              aria-hidden="true"
            />
            {t("flag_onboarding_incomplete", locale)}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  defaultDir,
  sortState,
  baseParams,
  className,
  align = "start",
}: {
  label: string;
  sortKey: SubscriberSortKey;
  defaultDir: "asc" | "desc";
  sortState: SortState;
  baseParams: Record<string, string>;
  className?: string;
  align?: "start" | "end";
}) {
  const active = sortState.sort === sortKey;
  const nextDir = active ? (sortState.dir === "asc" ? "desc" : "asc") : defaultDir;
  // page omitted → back to page 1 on a sort change.
  const href = buildQuery(baseParams, { sort: sortKey, dir: nextDir, page: undefined });

  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={href}
        className={`inline-flex min-h-11 items-center gap-1 hover:text-brand-ink ${
          align === "end" ? "flex-row-reverse" : ""
        } ${active ? "text-brand-ink" : ""}`}
      >
        {label}
        {active ? (
          sortState.dir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : null}
      </Link>
    </th>
  );
}
