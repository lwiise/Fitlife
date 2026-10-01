/**
 * Which screen under /admin/subscribers/<id> a path is — what the segment's
 * loading skeleton (RouteSkeleton, a client component) draws. Its own module,
 * free of the admin dictionary: the skeleton is on every route of the
 * segment, so whatever it imports reaches the health page and the plan and
 * program views too. model.ts re-exports it.
 */
export type SubscriberRouteKind = "family" | "health" | "viewer";

export function subscriberRouteKind(pathname: string): SubscriberRouteKind {
  const parts = pathname.split("/").filter(Boolean);
  const at = parts.indexOf("subscribers");
  const child = at >= 0 ? parts[at + 2] : undefined;
  if (child === "health") return "health";
  if (child === "plan" || child === "workout") return "viewer";
  return "family";
}
