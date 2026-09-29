import type { FamilyHeaderData } from "@/lib/admin/console-types";
import {
  fmtMoney,
  fmtNumber,
  fmtRelative,
  type AdminLocale,
  type Currency,
} from "@/lib/admin/format";
import { isLiveForCancellation } from "@/lib/admin/familyFlags";
import { t } from "@/lib/admin/i18n";
import { fmtDay } from "./helpers";
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
 * ends; anything else its period end, with «· إلغاء مجدول» when a live
 * subscription is set to cancel. No subscription reads «—».
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
  if (status === "trialing") {
    return (
      <>
        <span className="ad-muted">{t("fm_trial_ends", locale)}</span>{" "}
        <DateText iso={trialEndsAt} locale={locale} />
      </>
    );
  }
  return (
    <>
      <DateText iso={currentPeriodEnd} locale={locale} />
      {cancelAtPeriodEnd && isLiveForCancellation(status) ? (
        <span className="ad-bad"> · {t("cancel_scheduled", locale)}</span>
      ) : null}
    </>
  );
}

/**
 * The summary's key figures (the prototype's summary `kv`): people, renewal,
 * lifetime AI cost, last active.
 */
export function SummaryFacts({
  header,
  locale,
  currency,
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
            {fmtRelative(header.lastActivityAt, locale)}
          </time>
        ) : (
          "—"
        )}
      </Field>
    </dl>
  );
}
