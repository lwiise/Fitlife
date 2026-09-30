import type { FamilyHeaderData } from "@/lib/admin/console-types";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fmtDay, fmtRelativeTo, showsCancelScheduled } from "./helpers";
import { DateText, Field, FlagChip } from "./parts";

/**
 * The household count cell (the prototype's `householdCell`): beneficiaries,
 * «+ الطبّاخة» when there is a cook, and an over-limit flag. Takes the fields
 * a families-list row and a family header share.
 */
export function HouseholdCell({
  beneficiaries,
  hasHousekeeper,
  overLimit,
  locale,
}: {
  beneficiaries: number;
  hasHousekeeper: boolean;
  overLimit: boolean;
  locale: AdminLocale;
}) {
  return (
    <>
      <span className="ad-num">{fmtNumber(beneficiaries, locale)}</span>
      {hasHousekeeper ? (
        <>
          {" "}
          <span className="ad-muted">{t("fm_plus_cook", locale)}</span>
        </>
      ) : null}
      {overLimit ? (
        <>
          {" "}
          <FlagChip tone="crit">{t("flag_over_limit", locale)}</FlagChip>
        </>
      ) : null}
    </>
  );
}

/**
 * The renewal cell (the prototype's `renewalCell`): a trial shows when it
 * ends; anything else its period end — and either way «· إلغاء مجدول» when
 * the subscription is set to cancel and has not expired (the old list's rule,
 * which showed it on every status: see `showsCancelScheduled`). No
 * subscription reads «—».
 */
export function RenewalCell({
  status,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  locale,
}: {
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  locale: AdminLocale;
}) {
  if (!status) return <>—</>;
  const cancelling = showsCancelScheduled(status, cancelAtPeriodEnd) ? (
    <span className="ad-bad"> · {t("cancel_scheduled", locale)}</span>
  ) : null;
  if (status === "trialing") {
    return (
      <>
        <span className="ad-muted">{t("fm_trial_ends", locale)}</span>{" "}
        <DateText iso={trialEndsAt} locale={locale} />
        {cancelling}
      </>
    );
  }
  return (
    <>
      <DateText iso={currentPeriodEnd} locale={locale} />
      {cancelling}
    </>
  );
}

/**
 * The summary's key figures (the prototype's summary `kv`): people, renewal,
 * lifetime AI cost, last active.
 *
 * `nowIso` is REQUIRED: "last active" is relative («قبل ساعتين»), and a
 * relative time must be measured from a "now" the caller fixes — the server
 * page's request time, or the moment the panel's data was fetched — never
 * from the clock during render, which would differ between the server render
 * and hydration.
 */
export function SummaryFacts({
  header,
  locale,
  currency,
  nowIso,
}: {
  header: Pick<
    FamilyHeaderData,
    | "beneficiaries"
    | "hasHousekeeper"
    | "overLimit"
    | "subscription"
    | "lifetimeAiCostUsd"
    | "lastActivityAt"
  >;
  locale: AdminLocale;
  currency: Currency;
  /** ISO time "now" is — e.g. new Date().toISOString() in the page's server code. */
  nowIso: string;
}) {
  const sub = header.subscription;
  return (
    <dl className="ad-kv">
      <Field label={t("fm_people", locale)}>
        <HouseholdCell
          beneficiaries={header.beneficiaries}
          hasHousekeeper={header.hasHousekeeper}
          overLimit={header.overLimit}
          locale={locale}
        />
      </Field>
      <Field label={t("fm_renews", locale)}>
        <RenewalCell
          status={sub?.status ?? null}
          trialEndsAt={sub?.trialEndsAt ?? null}
          currentPeriodEnd={sub?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
          locale={locale}
        />
      </Field>
      <Field label={t("fm_lifetime_ai", locale)}>
        {header.lifetimeAiCostUsd > 0 ? (
          <span className="ad-num">{fmtMoney(header.lifetimeAiCostUsd, currency, locale, 2)}</span>
        ) : (
          <span className="ad-muted">—</span>
        )}
      </Field>
      <Field label={t("fm_last_active", locale)}>
        {header.lastActivityAt ? (
          <time dateTime={header.lastActivityAt} title={fmtDay(header.lastActivityAt, locale)}>
            {fmtRelativeTo(header.lastActivityAt, nowIso, locale)}
          </time>
        ) : (
          "—"
        )}
      </Field>
    </dl>
  );
}
