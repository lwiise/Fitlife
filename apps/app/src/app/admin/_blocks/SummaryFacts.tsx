import type { FamilyHeaderData, SubscriptionCancelState } from "@/lib/admin/console-types";
import { renewalDateAt } from "@/lib/admin/familyFlags";
import { fmtMoney, fmtNumber, type AdminLocale, type Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { joinSep } from "../_ui/Sep";
import { fmtDay, fmtRelativeTo } from "./helpers";
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
 * ends; anything else the date it is paid through (`renewalDateAt` — the
 * next renewal, or the day a cancelled subscription runs out) — and either
 * way «إلغاء مجدول» behind a separator while the cancellation is scheduled. `cancelState` is
 * the loader's verdict (subscriptionCancelState), never re-judged here. No
 * subscription reads «—».
 */
export function RenewalCell({
  status,
  trialEndsAt,
  currentPeriodEnd,
  endsAt,
  cancelState,
  locale,
}: {
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  endsAt: string | null;
  cancelState: SubscriptionCancelState;
  locale: AdminLocale;
}) {
  if (!status) return <>—</>;
  const date = (
    <DateText iso={renewalDateAt({ status, trialEndsAt, currentPeriodEnd, endsAt })} locale={locale} />
  );
  const cancelling =
    cancelState === "scheduled" ? (
      <span className="ad-bad">{t("cancel_scheduled", locale)}</span>
    ) : null;
  if (status === "trialing") {
    return (
      <>
        {joinSep(
          <>
            <span className="ad-muted">{t("fm_trial_ends", locale)}</span> {date}
          </>,
          cancelling,
        )}
      </>
    );
  }
  return <>{joinSep(date, cancelling)}</>;
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
    | "cancelState"
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
          endsAt={sub?.endsAt ?? null}
          cancelState={header.cancelState}
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
