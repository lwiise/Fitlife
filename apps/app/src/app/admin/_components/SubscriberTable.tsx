import Link from "next/link";
import { ArrowDown, ArrowUp, Sparkles, UserCog, AlertTriangle } from "lucide-react";
import type { SubscriberListResult, SubscriberSortKey } from "@/lib/admin/types";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtNumber, fmtRelative, fmtUsd } from "@/lib/admin/format";
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
  locale,
}: {
  result: SubscriberListResult;
  baseParams: Record<string, string>;
  sortState: SortState;
  locale: AdminLocale;
}) {
  const th =
    "whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase text-brand-ink-muted";

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-ink/10 bg-surface-elevated">
      <table
        className="w-full min-w-[60rem] border-collapse text-start"
        aria-labelledby="admin-subscribers-heading"
      >
        <thead className="sticky top-0 z-10 bg-surface-elevated shadow-[0_1px_0_rgba(26,16,35,0.08)]">
          <tr className="text-start">
            <SortHeader
              label={t("col_name", locale)}
              sortKey="displayName"
              defaultDir="asc"
              sortState={sortState}
              baseParams={baseParams}
              className={`${th} text-start`}
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
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="px-3 py-16 text-center text-sm text-brand-ink-muted"
              >
                {t("table_no_match", locale)}
              </td>
            </tr>
          ) : (
            result.rows.map((r) => (
              <tr
                key={r.userId}
                className="border-t border-brand-ink/5 align-middle transition-colors hover:bg-brand-surface/70"
              >
                {/* Name + email (the row's link to the drill-down) */}
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/subscribers/${r.userId}`}
                    className="group flex flex-col gap-0.5"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-brand-ink group-hover:text-brand-purple-900">
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
                    <span dir="ltr" className="text-xs text-brand-ink-muted">
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

                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink-muted">
                  {fmtDate(r.signupAt, locale)}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink-muted">
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
                  <span dir="ltr" className="tabular-nums text-brand-ink">
                    {fmtNumber(r.plansGenerated, locale)}
                  </span>
                  {r.failedPlans > 0 ? (
                    <span
                      dir="ltr"
                      className="ms-1 text-xs text-red-700"
                      title={`${fmtNumber(r.failedPlans, locale)} ${t("failed_plans", locale)}`}
                    >
                      · {fmtNumber(r.failedPlans, locale)}
                    </span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-brand-ink-muted">
                  {r.lastActivityAt ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3 opacity-50" aria-hidden="true" />
                      {fmtRelative(r.lastActivityAt, locale)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-end">
                  <span dir="ltr" className="tabular-nums text-brand-ink">
                    {fmtUsd(r.lifetimeAiCostUsd, locale)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
    <th scope="col" className={className} aria-sort={active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:text-brand-ink ${
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
