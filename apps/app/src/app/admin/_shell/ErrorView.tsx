"use client";

import { useEffect, useSyncExternalStore } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/format";
import { errorString } from "@/lib/admin/strings/errors";
import { Btn, BtnLink } from "../_ui/Button";

function noopSubscribe() {
  return () => {};
}

/** The boundary has no server props; read the language the admin layout set. */
function readLocale(): AdminLocale {
  const root = document.querySelector(".admin-root");
  return root?.getAttribute("lang") === "en" ? "en" : "ar";
}

function serverLocale(): AdminLocale {
  return "ar";
}

/**
 * The console's error screen, shared by app/admin/error.tsx (outside the
 * frame) and app/admin/(console)/error.tsx (inside it, so a failing page keeps
 * the rail and top bar). Retry re-fetches and re-renders the segment; the
 * digest lets an operator quote the server log entry.
 *
 * Every admin route loads this component (the error boundaries), so its
 * strings come from their own small module (strings/errors.ts) — importing
 * the admin dictionary here would ship all of it, both languages, to every
 * route, the login page included.
 */
export function ErrorView({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = useSyncExternalStore(noopSubscribe, readLocale, serverLocale);

  useEffect(() => {
    console.error("[admin] render error", error);
  }, [error]);

  return (
    <div className="ad-error">
      <div className="ad-error-card" role="alert">
        <span className="ad-error-ic" aria-hidden="true">
          <TriangleAlert className="ad-ic" />
        </span>
        <h1>{errorString("sh_error_title", locale)}</h1>
        <p>{errorString(error.digest ? "sh_error_body_ref" : "sh_error_body", locale)}</p>
        {error.digest ? (
          <p className="ad-ref">
            {errorString("sh_error_ref", locale)}
            <span className="ad-mono" dir="ltr" translate="no">
              {error.digest}
            </span>
          </p>
        ) : null}
        <div className="ad-row">
          <Btn variant="primary" icon={RotateCcw} onClick={() => retry()}>
            {errorString("retry", locale)}
          </Btn>
          <BtnLink href="/admin" variant="secondary">
            {errorString("sh_back_overview", locale)}
          </BtnLink>
        </div>
      </div>
    </div>
  );
}
