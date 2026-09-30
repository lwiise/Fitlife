import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { FamilyTab } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { PlanStatePill } from "../_blocks";
import { fmtDay } from "../_blocks/helpers";
import { AuditLine, LinkPending } from "../_ui";
import { familyTabHref } from "./model";

/**
 * The head of a read-only plan or program page: a crumb back to the family's
 * tab it was opened from (named after the family when the name is known),
 * the title, when it was generated, that the view is the family's own
 * screen, its status, and the audit line. Returned as siblings for
 * `.ad-a-page-in`.
 */
export function ViewerHead({
  userId,
  backTab,
  familyName,
  title,
  status,
  createdAt,
  generatedAt,
  audit,
  locale,
}: {
  userId: string;
  backTab: FamilyTab;
  familyName: string | null;
  title: string;
  /** Raw row status (ready / generating / failed / archived). */
  status: string;
  createdAt: string;
  generatedAt: string | null;
  /** The audit sentence for this kind of view. */
  audit: string;
  locale: AdminLocale;
}) {
  const at = generatedAt ?? createdAt;
  return (
    <>
      <Link href={familyTabHref(userId, backTab)} className="ad-crumb">
        <ChevronLeft className="ad-ic ad-flip" aria-hidden="true" />
        <bdi>{familyName ?? t("fp_family_page", locale)}</bdi>
        <LinkPending />
      </Link>
      <div className="ad-p-head">
        <div>
          <h1>{title}</h1>
          <p className="ad-sub">
            {t(generatedAt ? "fm_generated" : "fm_started", locale)}{" "}
            <time dateTime={at}>{fmtDay(at, locale)}</time> · {t("fp_read_only", locale)}
          </p>
          <div className="ad-chipsrow">
            <PlanStatePill state={status} locale={locale} />
          </div>
        </div>
      </div>
      <AuditLine>{audit}</AuditLine>
    </>
  );
}
