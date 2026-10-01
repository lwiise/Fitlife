"use client";

import { createContext, use, type ReactNode } from "react";
import type { FamilyHeaderData } from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { AccountDangerZone } from "../_components/AccountDangerZone";
import { BillingView, SummaryView } from "./headViews";

/**
 * The family's header, as the family layout read it, for the tab bodies
 * under it.
 *
 * The layout renders the page head once per visit to a family; a tab switch
 * changes only `?tab`, which re-renders the page segment and not the layout,
 * so the header is never read again for it. The tabs built from the header —
 * the summary's frame, billing, the account actions — render from this same
 * read instead of repeating it: switching to billing or to the account tab
 * costs no data read at all, and those tabs always agree with the head above
 * them (one read, one moment). An account action that changes the header
 * (deactivate, reactivate) refreshes the whole route, layout included, so the
 * snapshot follows it.
 */
const HeadContext = createContext<FamilyHeaderData | null>(null);

/** Set by the family layout around the page. */
export function FamilyHeadProvider({
  head,
  children,
}: {
  head: FamilyHeaderData;
  children: ReactNode;
}) {
  return <HeadContext value={head}>{children}</HeadContext>;
}

function useFamilyHead(): FamilyHeaderData {
  const head = use(HeadContext);
  if (!head) throw new Error("A family tab body rendered outside the family layout.");
  return head;
}

/** The summary, around its two section panels (rendered on the server). */
export function SummaryFromHead({
  meal,
  program,
  locale,
  currency,
  nowIso,
}: {
  meal: ReactNode;
  program: ReactNode;
  locale: AdminLocale;
  currency: Currency;
  nowIso: string;
}) {
  const head = useFamilyHead();
  return (
    <SummaryView
      userId={head.userId}
      header={head}
      meal={meal}
      program={program}
      locale={locale}
      currency={currency}
      nowIso={nowIso}
    />
  );
}

/** The billing tab: nothing in it that the header does not hold. */
export function BillingFromHead({ locale }: { locale: AdminLocale }) {
  return <BillingView header={useFamilyHead()} locale={locale} />;
}

/** The account actions, for the account the head shows. */
export function AccountFromHead({ locale }: { locale: AdminLocale }) {
  const head = useFamilyHead();
  return (
    <AccountDangerZone
      userId={head.userId}
      email={head.email}
      displayName={head.displayName}
      deactivated={head.deactivated}
      locale={locale}
    />
  );
}
