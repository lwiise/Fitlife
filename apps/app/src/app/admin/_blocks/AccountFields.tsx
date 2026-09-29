import type { FamilyHeaderData } from "@/lib/admin/console-types";
import {
  fmtMoney,
  fmtNumber,
  fmtRelative,
  type AdminLocale,
  type Currency,
} from "@/lib/admin/format";
import { localeName, t } from "@/lib/admin/i18n";
import { fmtDay } from "./helpers";
import { DateText, Field, FlagChip, Ltr, Pill } from "./parts";

/**
 * The account (the prototype's `accountFields`): email, language, signup,
 * onboarding, family preferences, mom profile — plus whether sign-in is
 * blocked (a deactivated account).
 */
export function AccountFields({
  header,
  locale,
}: {
  header: Pick<
    FamilyHeaderData,
    | "email"
    | "preferredLanguage"
    | "signupAt"
    | "onboardingCompletedAt"
    | "familyWideCompletedAt"
    | "momProfileCompletedAt"
    | "deactivated"
  >;
  locale: AdminLocale;
}) {
  return (
    <dl className="ad-kv">
      <Field label={t("field_email", locale)}>
        {header.email ? <Ltr mono>{header.email}</Ltr> : "—"}
      </Field>
      <Field label={t("field_locale", locale)}>
        {localeName(header.preferredLanguage)} <Ltr mono>{header.preferredLanguage}</Ltr>
      </Field>
      <Field label={t("field_signup", locale)}>
        <DateText iso={header.signupAt} locale={locale} />
      </Field>
      <Field label={t("field_onboarding", locale)}>
        {header.onboardingCompletedAt ? (
          <>
            {t("onboarding_complete", locale)} ·{" "}
            <DateText iso={header.onboardingCompletedAt} locale={locale} />
          </>
        ) : (
          <FlagChip tone="warn">{t("fm_flag_onboarding", locale)}</FlagChip>
        )}
      </Field>
      <Field label={t("field_family_wide", locale)}>
        {header.familyWideCompletedAt ? (
          <DateText iso={header.familyWideCompletedAt} locale={locale} />
        ) : (
          t("not_set", locale)
        )}
      </Field>
      <Field label={t("field_mom_profile", locale)}>
        {header.momProfileCompletedAt ? (
          <DateText iso={header.momProfileCompletedAt} locale={locale} />
        ) : (
          t("not_set", locale)
        )}
      </Field>
      <Field label={t("fm_sign_in", locale)}>
        {header.deactivated ? (
          <Pill tone="crit">{t("account_deactivated", locale)}</Pill>
        ) : (
          <Pill tone="ok">{t("account_active", locale)}</Pill>
        )}
      </Field>
    </dl>
  );
}

/**
 * Advisor engagement (the prototype's `engagementFields`): messages, last
 * chat (relative, with the date on hover) and what the chat cost. Costs keep
 * four decimals so a few cents never read as zero.
 */
export function EngagementFields({
  header,
  locale,
  currency,
}: {
  header: Pick<FamilyHeaderData, "engagement">;
  locale: AdminLocale;
  currency: Currency;
}) {
  const { chatCount, lastChatAt, chatCostUsd } = header.engagement;
  return (
    <dl className="ad-kv">
      <Field label={t("field_chat_count", locale)}>
        <span className="ad-num">{fmtNumber(chatCount, locale)}</span>
      </Field>
      <Field label={t("fm_chat_last", locale)}>
        {lastChatAt ? (
          <time dateTime={lastChatAt} title={fmtDay(lastChatAt, locale)}>
            {fmtRelative(lastChatAt, locale)}
          </time>
        ) : (
          "—"
        )}
      </Field>
      <Field label={t("field_chat_cost", locale)}>
        <span className="ad-num">{fmtMoney(chatCostUsd, currency, locale, 4, 4)}</span>
      </Field>
    </dl>
  );
}
