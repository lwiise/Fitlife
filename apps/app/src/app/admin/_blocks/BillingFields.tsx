import type { SubscriptionRow } from "@/lib/admin/detail";
import type { FamilyHeaderData } from "@/lib/admin/console-types";
import { paidThroughAt } from "@/lib/admin/familyFlags";
import type { AdminLocale } from "@/lib/admin/format";
import { cadenceLabel, t } from "@/lib/admin/i18n";
import { rangeArrow } from "./helpers";
import { DateText, Field, Ltr, SubscriptionStatusPill, TierTag } from "./parts";

/** A LemonSqueezy id, or «—». */
function LsId({ id }: { id: string | null }) {
  return id ? <Ltr mono>{id}</Ltr> : <>—</>;
}

/**
 * The current subscription (the prototype's `billingFields`): tier, status,
 * billing cycle, trial range, period end, cancel scheduled, the cancellation
 * date when there is one, and the three LemonSqueezy ids. A family that never
 * subscribed reads «بدون اشتراك».
 *
 * The cancel_scheduled reason sends the operator here, so the two
 * cancellation fields say what the header and the list say: «إلغاء مجدول»
 * is the header's `cancelState` (subscriptionCancelState), never the raw
 * flag, and the period end is what the subscription is paid through — its
 * ends_at when a portal cancellation arrived without a period end.
 */
export function BillingFields({
  header,
  locale,
}: {
  header: Pick<FamilyHeaderData, "subscription" | "cancelState">;
  locale: AdminLocale;
}) {
  const sub = header.subscription;
  if (!sub) return <p className="ad-muted">{t("status_none", locale)}</p>;
  const hasTrial = sub.trialStartedAt != null || sub.trialEndsAt != null;
  return (
    <dl className="ad-kv">
      <Field label={t("col_tier", locale)}>
        <TierTag tier={sub.tier} locale={locale} />
      </Field>
      <Field label={t("col_status", locale)}>
        <SubscriptionStatusPill status={sub.status} locale={locale} />
      </Field>
      <Field label={t("field_cadence", locale)}>{cadenceLabel(sub.cadence, locale)}</Field>
      <Field label={t("field_trial", locale)}>
        {hasTrial ? (
          <span>
            <DateText iso={sub.trialStartedAt} locale={locale} /> {rangeArrow(locale)}{" "}
            <DateText iso={sub.trialEndsAt} locale={locale} />
          </span>
        ) : (
          "—"
        )}
      </Field>
      <Field label={t("field_period_end", locale)}>
        <DateText iso={paidThroughAt(sub)} locale={locale} />
      </Field>
      <Field label={t("cancel_scheduled", locale)}>
        {header.cancelState === "scheduled" ? t("yes", locale) : t("no", locale)}
      </Field>
      {sub.cancelledAt ? (
        <Field label={t("fm_cancelled_at", locale)}>
          <DateText iso={sub.cancelledAt} locale={locale} />
        </Field>
      ) : null}
      <Field label={t("field_ls_sub", locale)}>
        <LsId id={sub.lemonsqueezySubscriptionId} />
      </Field>
      <Field label={t("field_ls_customer", locale)}>
        <LsId id={sub.lemonsqueezyCustomerId} />
      </Field>
      <Field label={t("field_ls_variant", locale)}>
        <LsId id={sub.lemonsqueezyVariantId} />
      </Field>
    </dl>
  );
}

/**
 * Every subscription row the family has had, newest first (status, tier,
 * cycle, created). Shown only when there is more than one — a single row is
 * already the current subscription — so it renders nothing otherwise; wrap
 * it in its card only when `rows.length > 1`.
 */
export function SubscriptionHistory({
  rows,
  locale,
}: {
  rows: readonly SubscriptionRow[];
  locale: AdminLocale;
}) {
  if (rows.length <= 1) return null;
  return (
    <div className="ad-tbl-wrap">
      <table className="ad-tbl" aria-label={t("section_sub_history", locale)}>
        <thead>
          <tr>
            <th scope="col">{t("col_status", locale)}</th>
            <th scope="col">{t("col_tier", locale)}</th>
            <th scope="col">{t("field_cadence", locale)}</th>
            <th scope="col">{t("fm_col_created", locale)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.createdAt}-${i}`}>
              <td>
                <SubscriptionStatusPill status={row.status} locale={locale} />
              </td>
              <td>
                <TierTag tier={row.tier} locale={locale} />
              </td>
              <td>{cadenceLabel(row.cadence, locale)}</td>
              <td>
                <DateText iso={row.createdAt} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
