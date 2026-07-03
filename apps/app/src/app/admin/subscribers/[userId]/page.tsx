import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  HeartPulse,
  History,
  MessageSquare,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import {
  loadSubscriberDetail,
  type GenerationSummary,
  type MemberSummary,
  type PlanSummary,
  type SubscriptionRow,
} from "@/lib/admin/detail";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { fmtDate, fmtMoney, fmtNumber, fmtRelative } from "@/lib/admin/format";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
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
import { DataTable, type DataColumn } from "../../_components/DataTable";
import { Chip } from "../../_components/Chip";
import { StatusBadge } from "../../_components/StatusBadge";
import { TierBadge } from "../../_components/TierBadge";
import { AccountDangerZone } from "../../_components/AccountDangerZone";

export default async function SubscriberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await requireAdmin();
  const { userId } = await params;
  const { error: actionError } = await searchParams;

  const detail = await loadSubscriberDetail(userId);
  if (!detail) notFound();

  const locale = await getAdminLocale();
  const currency = await getAdminCurrency();

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
        currency={currency}
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
        {actionError === "audit_failed" ? (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50/40 p-4 text-sm font-medium text-red-800"
          >
            {t("audit_write_failed", locale)}
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard title={t("section_account", locale)} icon={User}>
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

          <DetailCard title={t("section_subscription", locale)} icon={CreditCard}>
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
          icon={Users}
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

        <DetailCard
          title={t("section_plans", locale)}
          icon={CalendarDays}
          className="p-0"
        >
          <PlansTable
            plans={detail.plans}
            userId={userId}
            locale={locale}
            currency={currency}
          />
        </DetailCard>

        <DetailCard
          title={t("section_generations", locale)}
          icon={Sparkles}
          className="p-0"
        >
          <GenerationsTable
            generations={detail.generations}
            locale={locale}
            currency={currency}
          />
        </DetailCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard title={t("section_engagement", locale)} icon={MessageSquare}>
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
                value={fmtMoney(detail.engagement.chatCostUsd, currency, locale, 4, 4)}
                mono
              />
            </dl>
          </DetailCard>

          {detail.subscriptionHistory.length > 1 ? (
            <DetailCard
              title={t("section_sub_history", locale)}
              icon={History}
              className="p-0"
            >
              <SubHistoryTable rows={detail.subscriptionHistory} locale={locale} />
            </DetailCard>
          ) : null}
        </div>

        <AccountDangerZone
          userId={userId}
          email={detail.email}
          deactivated={detail.deactivated}
          locale={locale}
        />
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

function HouseholdTable({
  members,
  locale,
}: {
  members: MemberSummary[];
  locale: AdminLocale;
}) {
  const columns: DataColumn<MemberSummary>[] = [
    {
      key: "name",
      header: t("col_name", locale),
      primary: true,
      cell: (m) => (
        <>
          <span className="font-medium text-brand-ink">{m.name}</span>
          <span className="ms-1.5 text-xs text-brand-ink-muted">
            {roleLabel(m.role, locale)}
          </span>
        </>
      ),
    },
    {
      key: "goal",
      header: t("field_goal", locale),
      cell: (m) => goalLabel(m.primaryGoal, locale),
    },
    {
      key: "calories",
      header: t("field_calories", locale),
      align: "end",
      cell: (m) =>
        m.caloriesTarget != null ? (
          <span dir="ltr" className="tabular-nums">
            {fmtNumber(m.caloriesTarget, locale)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "macros",
      header: t("field_macros", locale),
      cell: (m) =>
        m.macros ? (
          <span dir="ltr" className="tabular-nums text-brand-ink-muted">
            {m.macros.protein_g} / {m.macros.carbs_g} / {m.macros.fat_g}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "flags",
      header: t("section_flags", locale),
      block: true,
      cell: (m) => (
        <span className="flex flex-wrap gap-1">
          {m.medicalGate ? (
            <Chip tone="danger">{t("flag_medical_gate", locale)}</Chip>
          ) : null}
          {m.pickyEater ? (
            <Chip tone="neutral">{t("flag_picky", locale)}</Chip>
          ) : null}
          {m.isHousekeeper ? (
            <Chip tone="neutral">{t("flag_housekeeper", locale)}</Chip>
          ) : null}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={members}
      rowKey={(m) => m.id}
      minWidthClass="min-w-[44rem]"
      empty={t("no_members", locale)}
    />
  );
}

function PlansTable({
  plans,
  userId,
  locale,
  currency,
}: {
  plans: PlanSummary[];
  userId: string;
  locale: AdminLocale;
  currency: Currency;
}) {
  const columns: DataColumn<PlanSummary>[] = [
    {
      key: "status",
      header: t("col_status", locale),
      primary: true,
      cell: (p) => planStatusLabel(p.status, locale),
    },
    {
      key: "date",
      header: t("col_signup", locale),
      cell: (p) => fmtDate(p.generatedAt ?? p.createdAt, locale),
    },
    {
      key: "days",
      header: t("field_days", locale),
      align: "end",
      cell: (p) => (
        <span dir="ltr" className="tabular-nums">
          {fmtNumber(p.daysCovered, locale)}
        </span>
      ),
    },
    {
      key: "tokens",
      header: t("field_tokens", locale),
      align: "end",
      cell: (p) => (
        <span dir="ltr" className="tabular-nums text-brand-ink-muted">
          {p.aiInputTokens != null ? fmtNumber(p.aiInputTokens, locale) : "—"} /{" "}
          {p.aiOutputTokens != null ? fmtNumber(p.aiOutputTokens, locale) : "—"}
        </span>
      ),
    },
    {
      key: "cost",
      header: t("field_cost", locale),
      align: "end",
      cell: (p) => (
        <span dir="ltr" className="tabular-nums">
          {p.costUsd != null ? fmtMoney(p.costUsd, currency, locale, 4, 4) : "—"}
        </span>
      ),
    },
    {
      key: "model",
      header: t("field_model", locale),
      cell: (p) => (
        <span dir="ltr" className="text-brand-ink-muted">
          {p.aiModel ?? "—"}
        </span>
      ),
    },
    {
      key: "inspect",
      header: "",
      full: true,
      cell: (p) => (
        <Link
          href={`/admin/subscribers/${userId}/plan/${p.id}`}
          className="inline-flex min-h-11 items-center text-xs font-semibold text-brand-purple-900 hover:underline"
        >
          {t("inspect_plan", locale)}
        </Link>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={plans}
      rowKey={(p) => p.id}
      minWidthClass="min-w-[52rem]"
      empty={t("no_plans", locale)}
    />
  );
}

function GenerationsTable({
  generations,
  locale,
  currency,
}: {
  generations: GenerationSummary[];
  locale: AdminLocale;
  currency: Currency;
}) {
  const columns: DataColumn<GenerationSummary>[] = [
    {
      key: "status",
      header: t("col_status", locale),
      primary: true,
      cell: (g) => genStatusLabel(g.status, locale),
    },
    {
      key: "date",
      header: t("col_signup", locale),
      cell: (g) => fmtDate(g.createdAt, locale),
    },
    {
      key: "model",
      header: t("field_model", locale),
      cell: (g) => (
        <span dir="ltr" className="text-brand-ink-muted">
          {g.model ?? "—"}
        </span>
      ),
    },
    {
      key: "tokens",
      header: t("field_tokens", locale),
      align: "end",
      cell: (g) => (
        <span dir="ltr" className="tabular-nums text-brand-ink-muted">
          {g.tokensIn != null ? fmtNumber(g.tokensIn, locale) : "—"} /{" "}
          {g.tokensOut != null ? fmtNumber(g.tokensOut, locale) : "—"}
        </span>
      ),
    },
    {
      key: "cost",
      header: t("field_cost", locale),
      align: "end",
      cell: (g) => (
        <span dir="ltr" className="tabular-nums">
          {g.costUsd != null ? fmtMoney(g.costUsd, currency, locale, 4, 4) : "—"}
        </span>
      ),
    },
    {
      key: "duration",
      header: t("field_duration", locale),
      align: "end",
      cell: (g) => (
        <span dir="ltr" className="tabular-nums text-brand-ink-muted">
          {g.durationMs != null ? `${(g.durationMs / 1000).toFixed(1)}s` : "—"}
        </span>
      ),
    },
    {
      key: "error",
      header: t("field_error", locale),
      block: true,
      hide: (g) => !g.errorMessage,
      cell: (g) =>
        g.errorMessage ? (
          <span
            className="block max-w-[16rem] truncate text-xs text-red-700"
            title={g.errorMessage}
          >
            {g.errorMessage}
          </span>
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={generations}
      rowKey={(g) => g.id}
      minWidthClass="min-w-[56rem]"
      empty={t("no_generations", locale)}
    />
  );
}

function SubHistoryTable({
  rows,
  locale,
}: {
  rows: SubscriptionRow[];
  locale: AdminLocale;
}) {
  const columns: DataColumn<SubscriptionRow>[] = [
    {
      key: "status",
      header: t("col_status", locale),
      primary: true,
      cell: (r) => <StatusBadge status={r.status} locale={locale} />,
    },
    {
      key: "tier",
      header: t("col_tier", locale),
      cell: (r) => <TierBadge tier={r.tier} locale={locale} />,
    },
    {
      key: "cadence",
      header: t("field_cadence", locale),
      cell: (r) => cadenceLabel(r.cadence, locale),
    },
    {
      key: "date",
      header: t("col_signup", locale),
      cell: (r) => fmtDate(r.createdAt, locale),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(_r, i) => String(i)}
      minWidthClass="min-w-[28rem]"
      empty={t("status_none", locale)}
    />
  );
}
