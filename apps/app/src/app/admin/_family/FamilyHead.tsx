import { FAMILY_TABS, type FamilyHeaderData } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { FamilyFlagChips, HealthLink } from "../_blocks";
import { fmtDay } from "../_blocks/helpers";
import { Ltr, Pill, StatusPill, TierBadge, joinSep, type LinkTab } from "../_ui";
import { FamiliesCrumb } from "./FamiliesCrumb";
import { FamilyTabs } from "./FamilyTabs";
import { familyName, familyTabHref, familyTabLabel } from "./model";

type Head = Pick<
  FamilyHeaderData,
  | "userId"
  | "displayName"
  | "email"
  | "signupAt"
  | "subscription"
  | "flags"
  | "medicalGateBlocked"
  | "deactivated"
>;

function tabItems(userId: string, locale: AdminLocale): LinkTab[] {
  return FAMILY_TABS.map((tab) => ({
    id: tab,
    label: familyTabLabel(tab, locale),
    href: familyTabHref(userId, tab),
  }));
}

/**
 * Tier, status and the family's flags (the prototype's chips row), plus a
 * deactivated account — the one state an operator must not miss before
 * acting on a family. The medical gate shows as a flag only; its detail stays
 * on the audited health page.
 */
function HeadChips({ header, locale }: { header: Head; locale: AdminLocale }) {
  const tier = header.subscription?.tier ?? null;
  return (
    <>
      {tier ? <TierBadge tier={tier} locale={locale} /> : null}
      <StatusPill status={header.subscription?.status ?? null} locale={locale} />
      {header.deactivated ? <Pill tone="crit">{t("account_deactivated", locale)}</Pill> : null}
      <FamilyFlagChips
        flags={header.flags}
        medicalGateBlocked={header.medicalGateBlocked}
        locale={locale}
      />
    </>
  );
}

/**
 * The page head from 1024px (the prototype's `aPage`): the crumb back to the
 * families list, the name with email and customer-since, the chips, the
 * protected health entry, and the tab bar. Returned as siblings for
 * `.ad-a-page-in`: the tab body must follow the tab bar directly so that a
 * pending tab switch dims it (admin.css, `.ad-tabs[aria-busy] ~ *`).
 *
 * Rendered by the family layout, once per visit: the tab bar finds the tab
 * shown in the URL itself (FamilyTabs), so a tab switch never re-renders the
 * head or re-reads what it shows.
 */
export function FamilyDeskHead({ header, locale }: { header: Head; locale: AdminLocale }) {
  const name = familyName(header.displayName, locale);
  return (
    <>
      <FamiliesCrumb label={t("sh_families", locale)} />
      <div className="ad-p-head ad-desk-only">
        <div>
          <h1>
            <bdi>{name}</bdi>
          </h1>
          <p className="ad-sub">
            {joinSep(
              header.email ? <Ltr>{header.email}</Ltr> : "—",
              <>
                {t("fm_customer_since", locale)}{" "}
                <time dateTime={header.signupAt}>{fmtDay(header.signupAt, locale)}</time>
              </>,
            )}
          </p>
          <div className="ad-chipsrow">
            <HeadChips header={header} locale={locale} />
          </div>
        </div>
        <div className="ad-p-actions">
          {/* The prototype labels this button with the household tab's name,
              which the tab bar below also carries. The hidden rest of its
              name says what it does instead: open the recorded health view. */}
          <HealthLink userId={header.userId} locale={locale}>
            {t("fp_tab_household", locale)}
            <span className="ad-sr">{` — ${t("view_health", locale)}`}</span>
          </HealthLink>
        </div>
      </div>
      <FamilyTabs
        items={tabItems(header.userId, locale)}
        label={t("fp_tabs", locale)}
        className="ad-desk-only"
      />
    </>
  );
}

/**
 * The page head below 1024px (the prototype's phone family screen): a white
 * band with the name, the chips and the tab bar, under the top bar that
 * carries the way back («‹ العائلات», _shell/PhoneBarTitle) — one bar, as the
 * prototype has it. The email and the health entry live in the summary and
 * household tabs there. Its tabs close the band, so a pending switch dims
 * everything after it.
 */
export function FamilyPhoneHead({ header, locale }: { header: Head; locale: AdminLocale }) {
  return (
    <div className="ad-ph-top ad-phone-only">
      <div>
        <h1 className="ad-ph-title">
          <bdi>{familyName(header.displayName, locale)}</bdi>
        </h1>
        <div className="ad-chips ad-ph-sub">
          <HeadChips header={header} locale={locale} />
        </div>
      </div>
      <FamilyTabs items={tabItems(header.userId, locale)} label={t("fp_tabs", locale)} />
    </div>
  );
}
