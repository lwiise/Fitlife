import type { FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The toggles' `next` return path. Rendered from the router (works without
 * JavaScript), then re-stamped from window.location at submit time — the
 * families page rewrites its query with history.replaceState, so only the
 * live location is guaranteed current. The server action accepts /admin paths
 * only.
 */
export function useReturnPath(): string {
  const pathname = usePathname() ?? "/admin";
  const search = useSearchParams()?.toString() ?? "";
  return search ? `${pathname}?${search}` : pathname;
}

export function stampReturnPath(event: FormEvent<HTMLFormElement>): void {
  const field = event.currentTarget.elements.namedItem("next");
  if (field instanceof HTMLInputElement) {
    field.value = `${window.location.pathname}${window.location.search}`;
  }
}
