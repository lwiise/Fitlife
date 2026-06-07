"use client";

import { useEffect } from "react";
import { t } from "@/lib/admin/i18n";

/**
 * Admin error boundary. Logs to the console (Sentry picks it up) and offers a
 * retry. Defaults to Arabic — the operator default.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render error", error);
  }, [error]);

  return (
    <main className="container-app grid min-h-[60vh] place-items-center py-12">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-brand-ink">{t("error_title", "ar")}</h1>
        <p className="mt-2 text-sm leading-7 text-brand-ink-muted">
          {t("error_body", "ar")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-purple-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-700"
        >
          {t("retry", "ar")}
        </button>
      </div>
    </main>
  );
}
