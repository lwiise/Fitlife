/**
 * Where the console's currency and language switches go once their server
 * action has set its cookie (setAdminCurrency / setAdminLocale in
 * app/admin/actions.ts). Shared by the forms and the actions, and pure.
 *
 * With JavaScript the form's onSubmit marks the post as scripted, and the
 * action refreshes the route the router is on WHEN THE ACTION RUNS. It must
 * not redirect to a path read in the browser: a switch pressed while a
 * navigation is still loading — an overview range, a family's tab — is queued
 * behind that navigation, and window.location still names the page being
 * left until the navigation commits, so the redirect snapped the operator
 * back to it, undoing the range or the tab they had just chosen.
 *
 * Without JavaScript the form posts natively and the action redirects to
 * `next`, the path + query the server rendered into the form — /admin paths
 * only, so the switch cannot be turned into an open redirect.
 */

/** The hidden field a switch form's onSubmit sets to "1" (only scripts run onSubmit). */
export const SCRIPTED_FIELD = "js";

export type ToggleReturn = { kind: "refresh" } | { kind: "redirect"; to: string };

export function toggleReturn(formData: FormData): ToggleReturn {
  if (formData.get(SCRIPTED_FIELD) === "1") return { kind: "refresh" };
  const next = formData.get("next");
  return {
    kind: "redirect",
    to: typeof next === "string" && next.startsWith("/admin") ? next : "/admin",
  };
}
