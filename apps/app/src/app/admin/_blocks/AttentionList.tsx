import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { AttentionReason } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { SEVERITY_TONE, reasonSentence, severityLabel, toneClass } from "./helpers";

/**
 * Why a family needs attention, one sentence per reason, most severe first
 * (the loader's order). Renders nothing when there is no reason.
 *
 * `action` lets the caller append something to each reason — a link or a
 * button to the tab that resolves it (`reason.tab`). The panel switches tabs
 * in place; the page links to `?tab=`; so the block does not decide.
 */
export function AttentionList({
  reasons,
  locale,
  action,
}: {
  reasons: readonly AttentionReason[];
  locale: AdminLocale;
  action?: (reason: AttentionReason) => ReactNode;
}) {
  if (reasons.length === 0) return null;
  return (
    <ul className="ad-stack-8" aria-label={t("fm_reasons_label", locale)}>
      {reasons.map((reason) => (
        <li key={reason.flag} className={`ad-reason ${toneClass(SEVERITY_TONE[reason.severity])}`}>
          <TriangleAlert className="ad-ic" aria-hidden="true" />
          <span>
            <span className="ad-sr">{severityLabel(reason.severity, locale)}: </span>
            {reasonSentence(reason, locale)}
          </span>
          {action ? <span className="ad-reason-act">{action(reason)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
