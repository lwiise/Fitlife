"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { MemberPlan } from "@fitlife/plan-engine";

export interface DownloadPDFButtonProps {
  memberPlan: MemberPlan;
  planMetadata: { week_start_date: string };
  // member_id → display name, for labelling who a shared meal is split between.
  memberNames?: Record<string, string>;
}

function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
}

export function DownloadPDFButton({
  memberPlan,
  planMetadata,
  memberNames,
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
      className="inline-flex items-center justify-center gap-2 bg-white border border-brand-ink/10 hover:bg-brand-surface disabled:opacity-60 disabled:cursor-not-allowed text-brand-ink font-bold text-sm px-5 py-2.5 rounded-full transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      {loading ? (
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      <span className="truncate max-w-[12rem]">
        {status === "error"
          ? "تعذّر التحميل، يرجى المحاولة مرة أخرى"
          : `تحميل PDF لـ ${memberPlan.member_name_ar}`}
      </span>
    </button>
  );
}
