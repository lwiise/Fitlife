"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

export function ExportButton({ ownerSex }: { ownerSex?: string | null }) {
  const g = genderPick(ownerSex);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    setIsLoading(true);
    try {
      // The endpoint responds with Content-Disposition: attachment, so the
      // browser downloads it without navigating away.
      window.location.assign("/api/account/export");
      // Re-enable shortly; the download itself doesn't fire a JS event.
      setTimeout(() => setIsLoading(false), 2500);
    } catch {
      setIsLoading(false);
      setError(g("ما قدرنا نجهّز الملف. حاولي مرة ثانية", "ما قدرنا نجهّز الملف. حاول مرة ثانية"));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        تنزيل بياناتي
      </button>
      {error && (
        <p role="alert" className="mt-2 text-red-700 text-xs leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
