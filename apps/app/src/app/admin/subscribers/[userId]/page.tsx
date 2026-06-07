import Link from "next/link";
import { notFound } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import {
  loadSubscriberDetail,
  type GenerationSummary,
  type MemberSummary,
  type PlanSummary,
  type SubscriptionRow,
} from "@/lib/admin/detail";
import type { AdminLocale } from "@/lib/admin/format";
import { fmtDate, fmtNumber, fmtRelative, fmtUsd } from "@/lib/admin/format";
import { getAdminLocale } from "@/lib/admin/locale";
import {
  cadenceLabel,
  genStatusLabel,
  goalLabel,
  planStatusLabel,
  roleLabel,
  t,
} from "@/lib/admin/i18n";
import { DetailHeader } from "../../_components/DetailHeader";
import { DetailCard, Field } from "../../_components/DetailCard";
import { Chip } from "../../_components/Chip";
import { StatusBadge } from "../../_components/StatusBadge";
import { TierBadge } from "../../_components/TierBadge";

export default async function SubscriberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await requireAdmin();
  const { userId } = await params;

  const detail = await loadSubscriberDetail(userId);
  if (!detail) notFound();

  const locale = await getAdminLocale();

  // PDPL: record the subscriber-detail access.
  await logAdminAccess({
    adminUserId: admin.userId,
    subscriberId: userId,
    action: "view_subscriber_detail",
  });

  const { account, subscription, flags } = detail;

  return (
    <>
      <DetailHeader
        backHref="/admin"
        backLabel={t("back_to_overview", locale)}
        name={account.displayName ?? "—"}
        email={detail.email}
        locale={locale}
        localeNext={`/admin/subscribers/${userId}`}
      >
        {subscription ? (
          <>
            <TierBadge tier={subscription.tier} locale={locale} />
            <StatusBadge status={subscription.status} locale={locale} />
          </>
        ) : (
          <StatusBadge status={null} locale={locale} />
        )}
        <FlagChips flags={flags} locale={locale} />
      </DetailHeader>

      <main className="container-app space-y-4 py-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard title={t("section_account", locale)}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Field label={t("field_email", locale)} value={detail.email} mono />
              <Field
                label={t("field_locale", locale)}
                value={account.preferredLanguage.toUpperCase()}
                mono
              />
              <Field
                label={t("field_signup", locale)}
                value={fmtDate(account.signupAt, locale)}
              />
              <Field
                label={t("field_onboarding", locale)}
                value={
                  account.onboardingCompletedAt
                    ? `${t("onboarding_complete", locale)} · ${fmtDate(account.onboardingCompletedAt, locale)}`
                    : t("flag_onboarding_incomplete", locale)
                }
              />
              <Field
                label={t("field_family_wide", locale)}
                value={
                  account.familyWideCompletedAt
                    ? fmtDate(account.familyWideCompletedAt, locale)
                    : t("not_set", locale)
                }
              />
              <Field
                label={t("field_mom_profile", locale)}
                value={
                  account.momProfileCompletedAt
                    ? fmtDate(account.momProfileCompletedAt, locale)
                    : t("not_set", locale)
                }
              />
            </dl>
          </DetailCard>

          <DetailCard title={t("section_subscription", locale)}>
            {subscription ? (
              <SubscriptionFields sub={subscription} locale={locale} />
            ) : (
              <p className="text-sm text-brand-ink-muted">
                {t("status_none", locale)}
              </p>
            )}
          </DetailCard>
        </div>

        <DetailCard
          title={t("section_household", locale)}
          action={
            <Link
              href={`/admin/subscribers/${userId}/health`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-ink/15 px-3 text-xs font-semibold text-brand-purple-900 hover:bg-brand-surface"
            >
              <HeartPulse className="size-4" aria-hidden="true" />
              {t("view_health", locale)}
            </Link>
          }
          className="p-0"
        >
          <HouseholdTable members={detail.members} locale={locale} />
        </DetailCard>

        <DetailCard title={t("section_plans", locale)} className="p-0">
          <PlansTable plans={detail.plans} userId={userId} locale={locale} />
        </DetailCard>

        <DetailCard title={t("section_generations", locale)} className="p-0">
          <GenerationsTable generations={detail.generations} locale={locale} />
        </DetailCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard title={t("section_engagement", locale)}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Field
                label={t("field_chat_count", locale)}
                value={fmtNumber(detail.engagement.chatCount, locale)}
                mono
              />
              <Field
                label={t("col_activity", locale)}
                value={
                  detail.engagement.lastChatAt
                    ? fmtRelative(detail.engagement.lastChatAt, locale)
                    : "—"
                }
              />
              <Field
                label={t("field_chat_cost", locale)}
                value={fmtUsd(detail.engagement.chatCostUsd, locale, 4)}
                mono
              />
            </dl>
          </DetailCard>

          {detail.subscriptionHistory.length > 1 ? (
            <DetailCard title={t("section_sub_history", locale)} className="p-0">
              <SubHistoryTable rows={detail.subscriptionHistory} locale={locale} />
            </DetailCard>
          ) : null}
        </div>
      </main>
    </>
  );
}

function FlagChips({
  flags,
  locale,
}: {
  flags: {
    medicalGateBlocked: boolean;
    overLimit: boolean;
    failedGenerations: number;
  };
  locale: AdminLocale;
}) {
  const any =
    flags.medicalGateBlocked || flags.overLimit || flags.failedGenerations > 0;
  if (!any) return <Chip tone="ok">{t("flags_clear", locale)}</Chip>;
  return (
    <>
      {flags.medicalGateBlocked ? (
        <Chip tone="danger">{t("flag_medical_blocked", locale)}</Chip>
      ) : null}
      {flags.overLimit ? (
        <Chip tone="danger">{t("flag_over_limit", locale)}</Chip>
      ) : null}
      {flags.failedGenerations > 0 ? (
        <Chip tone="warn">
          {fmtNumber(flags.failedGenerations, locale)} {t("flag_failed_gen", locale)}
        </Chip>
      ) : null}
    </>
  );
}

function SubscriptionFields({
  sub,
  locale,
}: {
  sub: SubscriptionRow;
  locale: AdminLocale;
}) {
  const trial =
    sub.trialStartedAt || sub.trialEndsAt
      ? `${fmtDate(sub.trialStartedAt, locale)} → ${fmtDate(sub.trialEndsAt, locale)}`
      : "—";
  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      <Field label={t("col_tier", locale)} value={<TierBadge tier={sub.tier} locale={locale} />} />
      <Field
        label={t("col_status", locale)}
        value={<StatusBadge status={sub.status} locale={locale} />}
      />
      <Field label={t("field_cadence", locale)} value={cadenceLabel(sub.cadence, locale)} />
      <Field label={t("field_trial", locale)} value={trial} mono />
      <Field
        label={t("field_period_end", locale)}
        value={fmtDate(sub.currentPeriodEnd, locale)}
      />
      <Field
        label={t("cancel_scheduled", locale)}
        value={sub.cancelAtPeriodEnd ? t("yes", locale) : t("no", locale)}
      />
      <Field label={t("field_ls_sub", locale)} value={sub.lemonsqueezySubscriptionId} mono />
      <Field label={t("field_ls_customer", locale)} value={sub.lemonsqueezyCustomerId} mono />
      <Field label={t("field_ls_variant", locale)} value={sub.lemonsqueezyVariantId} mono />
    </dl>
  );
}

const TH =
  "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase text-brand-ink-muted";
const TD = "whitespace-nowrap px-4 py-2.5 text-sm text-brand-ink";

function HouseholdTable({
  members,
  locale,
}: {
  members: MemberSummary[];
  locale: AdminLocale;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse">
        <thead className="border-b border-brand-ink/10">
          <tr>
            <th scope="col" className={TH}>{t("col_name", locale)}</th>
            <th scope="col" className={TH}>{t("field_goal", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_calories", locale)}</th>
            <th scope="col" className={TH}>{t("field_macros", locale)}</th>
            <th scope="col" className={TH}>{t("section_flags", locale)}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-brand-ink/5">
              <td className={TD}>
                <span className="font-medium">{m.name}</span>
                <span className="ms-1.5 text-xs text-brand-ink-muted">
                  {roleLabel(m.role, locale)}
                </span>
              </td>
              <td className={TD}>{goalLabel(m.primaryGoal, locale)}</td>
              <td className={`${TD} text-end`}>
                {m.caloriesTarget != null ? (
                  <span dir="ltr" className="tabular-nums">
                    {fmtNumber(m.caloriesTarget, locale)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={TD}>
                {m.macros ? (
                  <span dir="ltr" className="tabular-nums text-brand-ink-muted">
                    {m.macros.protein_g} / {m.macros.carbs_g} / {m.macros.fat_g}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={TD}>
                <span className="flex flex-wrap gap-1">
                  {m.medicalGate ? (
                    <Chip tone="danger">{t("flag_medical_gate", locale)}</Chip>
                  ) : null}
                  {m.pickyEater ? <Chip tone="neutral">{t("flag_picky", locale)}</Chip> : null}
                  {m.isHousekeeper ? (
                    <Chip tone="neutral">{t("flag_housekeeper", locale)}</Chip>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansTable({
  plans,
  userId,
  locale,
}: {
  plans: PlanSummary[];
  userId: string;
  locale: AdminLocale;
}) {
  if (plans.length === 0)
    return <p className="px-4 py-6 text-sm text-brand-ink-muted">{t("no_plans", locale)}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse">
        <thead className="border-b border-brand-ink/10">
          <tr>
            <th scope="col" className={TH}>{t("col_status", locale)}</th>
            <th scope="col" className={TH}>{t("col_signup", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_days", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_tokens", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_cost", locale)}</th>
            <th scope="col" className={TH}>{t("field_model", locale)}</th>
            <th scope="col" className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-t border-brand-ink/5">
              <td className={TD}>{planStatusLabel(p.status, locale)}</td>
              <td className={TD}>{fmtDate(p.generatedAt ?? p.createdAt, locale)}</td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums">
                  {fmtNumber(p.daysCovered, locale)}
                </span>
              </td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums text-brand-ink-muted">
                  {p.aiInputTokens != null ? fmtNumber(p.aiInputTokens, locale) : "—"} /{" "}
                  {p.aiOutputTokens != null ? fmtNumber(p.aiOutputTokens, locale) : "—"}
                </span>
              </td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums">
                  {p.costUsd != null ? fmtUsd(p.costUsd, locale, 4) : "—"}
                </span>
              </td>
              <td className={`${TD} text-brand-ink-muted`} dir="ltr">
                {p.aiModel ?? "—"}
              </td>
              <td className={TD}>
                <Link
                  href={`/admin/subscribers/${userId}/plan/${p.id}`}
                  className="text-xs font-semibold text-brand-purple-900 hover:underline"
                >
                  {t("inspect_plan", locale)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenerationsTable({
  generations,
  locale,
}: {
  generations: GenerationSummary[];
  locale: AdminLocale;
}) {
  if (generations.length === 0)
    return (
      <p className="px-4 py-6 text-sm text-brand-ink-muted">
        {t("no_generations", locale)}
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse">
        <thead className="border-b border-brand-ink/10">
          <tr>
            <th scope="col" className={TH}>{t("col_status", locale)}</th>
            <th scope="col" className={TH}>{t("col_signup", locale)}</th>
            <th scope="col" className={TH}>{t("field_model", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_tokens", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_cost", locale)}</th>
            <th scope="col" className={`${TH} text-end`}>{t("field_duration", locale)}</th>
            <th scope="col" className={TH}></th>
          </tr>
        </thead>
        <tbody>
          {generations.map((g) => (
            <tr key={g.id} className="border-t border-brand-ink/5">
              <td className={TD}>{genStatusLabel(g.status, locale)}</td>
              <td className={TD}>{fmtDate(g.createdAt, locale)}</td>
              <td className={`${TD} text-brand-ink-muted`} dir="ltr">
                {g.model ?? "—"}
              </td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums text-brand-ink-muted">
                  {g.tokensIn != null ? fmtNumber(g.tokensIn, locale) : "—"} /{" "}
                  {g.tokensOut != null ? fmtNumber(g.tokensOut, locale) : "—"}
                </span>
              </td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums">
                  {g.costUsd != null ? fmtUsd(g.costUsd, locale, 4) : "—"}
                </span>
              </td>
              <td className={`${TD} text-end`}>
                <span dir="ltr" className="tabular-nums text-brand-ink-muted">
                  {g.durationMs != null ? `${(g.durationMs / 1000).toFixed(1)}s` : "—"}
                </span>
              </td>
              <td className={`${TD} max-w-xs truncate text-xs text-red-700`}>
                {g.errorMessage ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubHistoryTable({
  rows,
  locale,
}: {
  rows: SubscriptionRow[];
  locale: AdminLocale;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse">
        <thead className="border-b border-brand-ink/10">
          <tr>
            <th scope="col" className={TH}>{t("col_status", locale)}</th>
            <th scope="col" className={TH}>{t("col_tier", locale)}</th>
            <th scope="col" className={TH}>{t("field_cadence", locale)}</th>
            <th scope="col" className={TH}>{t("col_signup", locale)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-brand-ink/5">
              <td className={TD}>
                <StatusBadge status={r.status} locale={locale} />
              </td>
              <td className={TD}>
                <TierBadge tier={r.tier} locale={locale} />
              </td>
              <td className={TD}>{cadenceLabel(r.cadence, locale)}</td>
              <td className={TD}>{fmtDate(r.createdAt, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
