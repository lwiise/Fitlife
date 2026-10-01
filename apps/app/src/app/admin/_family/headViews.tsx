import type { ReactNode } from "react";
import type { FamilyHeaderData } from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { AccountFields, EngagementFields } from "../_blocks/AccountFields";
import { AttentionList } from "../_blocks/AttentionList";
import { BillingFields, SubscriptionHistory } from "../_blocks/BillingFields";
import { SummaryFacts } from "../_blocks/SummaryFacts";
import { Panel, SecTitle } from "../_ui/Card";
import { TabLink } from "./TabLink";

/**
 * The family page's views built from the family's HEADER: the summary's
 * frame and the billing tab. The header is read once, by the family layout,
 * and reaches these through ./headSnapshot — a tab switch reads only the
 * sections its tab shows, never the header again. Presentational (no hooks)
 * and client-safe, so the snapshot's connectors can render them; each block
 * is imported from its own file to keep that client code small.
 *
 * Like ./views, each returns the page's direct children — cards and
 * `.ad-grid-2` rows — so the page's rhythm spaces them and a pending tab
 * switch dims them. Panel titles are h2 (the family's name is the page's h1).
 */

type Header = FamilyHeaderData;

/**
 * The summary (the prototype's summary tab): the flags with the tab that
 * resolves each, the key figures on phones, the meal plan and the program at
 * a glance, the account and the advisor's engagement. The two glance panels
 * come from the sections (./views: MealGlance, ProgramGlance), rendered on
 * the server and slotted in; everything else is the header's.
 */
export function SummaryView({
  userId,
  header,
  meal,
  program,
  locale,
  currency,
  nowIso,
}: {
  userId: string;
  header: Header;
  /** The meal plan at a glance (MealGlance). */
  meal: ReactNode;
  /** The exercise program at a glance (ProgramGlance). */
  program: ReactNode;
  locale: AdminLocale;
  currency: Currency;
  nowIso: string;
}) {
  return (
    <div className="ad-grid-2">
      <div className="ad-col">
        {header.reasons.length > 0 ? (
          <Panel>
            <SecTitle as="h2">{t("section_flags", locale)}</SecTitle>
            <AttentionList
              reasons={header.reasons}
              locale={locale}
              action={(reason) =>
                reason.tab === "summary" ? null : (
                  <TabLink userId={userId} tab={reason.tab} locale={locale} />
                )
              }
            />
          </Panel>
        ) : null}
        {/* The phone design leads with the key figures (people, renewal,
            lifetime AI cost, last active); from 1024px the page leaves them to
            the list and the panel, as the approved layout does. */}
        <Panel className="ad-phone-only">
          <SummaryFacts header={header} locale={locale} currency={currency} nowIso={nowIso} />
        </Panel>
        {meal}
        {program}
      </div>
      <div className="ad-col">
        <Panel>
          <SecTitle as="h2">{t("section_account", locale)}</SecTitle>
          <AccountFields header={header} locale={locale} />
        </Panel>
        <Panel>
          <SecTitle as="h2">{t("section_engagement", locale)}</SecTitle>
          <EngagementFields header={header} locale={locale} currency={currency} nowIso={nowIso} />
        </Panel>
      </div>
    </div>
  );
}

/** The subscription (and its history when there is more than one row) beside the account. */
export function BillingView({ header, locale }: { header: Header; locale: AdminLocale }) {
  return (
    <div className="ad-grid-2">
      <div className="ad-col">
        <Panel>
          <SecTitle as="h2">{t("section_subscription", locale)}</SecTitle>
          <BillingFields header={header} locale={locale} />
        </Panel>
        {header.subscriptionHistory.length > 1 ? (
          <Panel>
            <SecTitle as="h2">{t("section_sub_history", locale)}</SecTitle>
            <SubscriptionHistory rows={header.subscriptionHistory} locale={locale} />
          </Panel>
        ) : null}
      </div>
      <Panel>
        <SecTitle as="h2">{t("section_account", locale)}</SecTitle>
        <AccountFields header={header} locale={locale} />
      </Panel>
    </div>
  );
}
