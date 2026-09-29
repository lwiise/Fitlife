"use client";

import { ErrorView } from "./_shell/ErrorView";

/**
 * Admin error boundary for anything the console frame itself could not render
 * (the (console) layout, or a page when the frame is gone). Page errors inside
 * the frame are caught one level down by (console)/error.tsx, which keeps the
 * rail and top bar. Logs to the console (Sentry picks it up).
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView error={error} retry={retry} />;
}
