"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { MemberPlan } from "@fitlife/plan-engine";
import { PLAN_MENU_ICON_CLASS, PLAN_MENU_ITEM_CLASS } from "../bar/menuItem";

export interface DownloadPDFButtonProps {
  memberPlan: MemberPlan;
  planMetadata: { week_start_date: string };
  // member_id → display name, for labelling who a shared meal is split between.
  memberNames?: Record<string, string>;
  // Shared-meal absences (00021), keyed `day|slot|member`. Someone excluded from
  // an occurrence changes what the kitchen cooks: the batch is smaller and they
  // are not one of the people sharing it. Without this the printed sheet
  // overstates the amount and names someone who is not eating.
  absentKeys?: ReadonlySet<string>;
}

function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
}

export function DownloadPDFButton({
  memberPlan,
  planMetadata,
  memberNames,
  absentKeys,
}: DownloadPDFButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  // Generate the PDF only on click, via the imperative `pdf().toBlob()` API.
  // PDFDownloadLink renders the document inside React's render cycle on mount
  // (usePDF → flushSyncWork), which crashes under React 19; the imperative API
  // renders @react-pdf's tree standalone, off the React-DOM path, and any
  // failure here is caught so it can never take down the plan page.
  async function handleDownload() {
    setStatus("loading");
    try {
      const [{ pdf }, { MemberPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./MemberPlanPDF"),
      ]);

      const blob = await pdf(
        <MemberPlanPDF
          memberPlan={memberPlan}
          absentKeys={absentKeys}
          planMetadata={planMetadata}
          memberNames={memberNames}
        />,
      ).toBlob();

      const filename = `fitlife-plan-${safeFilename(memberPlan.member_name_ar)}-${planMetadata.week_start_date}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch (err) {
      console.error("[pdf] generation failed", err);
      setStatus("error");
    }
  }

  const loading = status === "loading";

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      // Renders as a row of the plan bar's ••• sheet — its only caller. The
      // sheet deliberately stays open while this generates (MoreSheet closes
      // only on links), so the spinner and the error label below are visible
      // where the user tapped.
      className={`${PLAN_MENU_ITEM_CLASS} disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <Loader2
          className={`${PLAN_MENU_ICON_CLASS} animate-spin motion-reduce:animate-none`}
          aria-hidden="true"
        />
      ) : (
        <Download className={PLAN_MENU_ICON_CLASS} aria-hidden="true" />
      )}
      {/* Wraps rather than truncates: the row is a full-width sheet row now,
          and the error sentence is the one line that must be read whole. */}
      <span className="min-w-0 flex-1">
        {status === "error"
          ? "تعذّر التحميل، يرجى المحاولة مرة أخرى"
          : `تحميل PDF لـ ${memberPlan.member_name_ar}`}
      </span>
    </button>
  );
}
