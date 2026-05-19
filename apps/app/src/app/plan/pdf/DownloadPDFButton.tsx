"use client";

import dynamic from "next/dynamic";
import { Download, Loader2 } from "lucide-react";
import type { MemberPlan } from "@/lib/plans/schema";

// Lazy-load react-pdf so the (heavy) library doesn't ship in the initial bundle.
// The placeholder button preserves the same dimensions while loading.
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 bg-brand-surface text-brand-ink-muted font-bold text-sm px-5 py-2.5 rounded-full min-h-[2.75rem] cursor-not-allowed"
      >
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        تحضير PDF...
      </button>
    ),
  },
);

const MemberPlanPDF = dynamic(
  () => import("./MemberPlanPDF").then((mod) => mod.MemberPlanPDF),
  { ssr: false },
);

export interface DownloadPDFButtonProps {
  memberPlan: MemberPlan;
  planMetadata: { week_start_date: string };
}

function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
}

export function DownloadPDFButton({
  memberPlan,
  planMetadata,
}: DownloadPDFButtonProps) {
  const filename = `fitlife-plan-${safeFilename(memberPlan.member_name_ar)}-${planMetadata.week_start_date}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <MemberPlanPDF memberPlan={memberPlan} planMetadata={planMetadata} />
      }
      fileName={filename}
      className="inline-flex items-center justify-center gap-2 bg-white border border-brand-ink/10 hover:bg-brand-surface text-brand-ink font-bold text-sm px-5 py-2.5 rounded-full transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      {({ loading }) => (
        <>
          {loading ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          <span className="truncate max-w-[12rem]">
            تحميل PDF لـ {memberPlan.member_name_ar}
          </span>
        </>
      )}
    </PDFDownloadLink>
  );
}
