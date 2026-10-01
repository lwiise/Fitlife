import type { FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SCRIPTED_FIELD } from "./toggleReturn";

/**
 * The switches' `next` return path, for a post made WITHOUT JavaScript: the
 * current path + query from the router, rendered into the form on the server,
 * where the action redirects once its cookie is set (see toggleReturn.ts).
 * The action accepts /admin paths only.
 */
export function useReturnPath(): string {
  const pathname = usePathname() ?? "/admin";
  const search = useSearchParams()?.toString() ?? "";
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * onSubmit runs only with JavaScript: it marks the post as scripted, so the
 * action refreshes whatever route the router is on when it runs instead of
 * redirecting to a path read here — which, while a navigation is still
 * loading, is the page being left (toggleReturn.ts).
 */
export function markScripted(event: FormEvent<HTMLFormElement>): void {
  const field = event.currentTarget.elements.namedItem(SCRIPTED_FIELD);
  if (field instanceof HTMLInputElement) field.value = "1";
}
