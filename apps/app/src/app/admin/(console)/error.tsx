"use client";

import { ErrorView } from "../_shell/ErrorView";

/**
 * A page that throws inside the console renders its error here, in the main
 * column, so the rail, top bar and ⌘K stay usable.
 */
export default function ConsoleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView error={error} retry={retry} />;
}
