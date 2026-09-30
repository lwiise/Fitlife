import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { FamilyTab } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { fill } from "../_blocks/helpers";
import { LinkPending, TextLink } from "../_ui";
import { familyTabHref, familyTabLabel } from "./model";

/**
 * A link from inside a tab body to another tab of the same family page — the
 * prototype's «فتح ›» on the summary's panels, and the tab beside an
 * attention reason. Like the tab bar it keeps the scroll position, and its
 * underline pulses while the next tab is on its way. The accessible name
 * always says which section it opens («فتح قسم الاشتراك»), even when the
 * visible text is only «فتح».
 */
export function TabLink({
  userId,
  tab,
  locale,
  children,
}: {
  userId: string;
  tab: FamilyTab;
  locale: AdminLocale;
  /** Visible text; the tab's own name when omitted. */
  children?: ReactNode;
}) {
  const name = familyTabLabel(tab, locale);
  return (
    <TextLink
      href={familyTabHref(userId, tab)}
      scroll={false}
      aria-label={fill(t("fp_go_tab", locale), { tab: name })}
      iconEnd={ChevronRight}
    >
      {children ?? name}
      <LinkPending />
    </TextLink>
  );
}
