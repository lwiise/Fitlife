"use client";

import { usePathname } from "next/navigation";
import { subscriberRouteKind } from "./routeKind";
import { FamilyPageSkeleton, HealthPageSkeleton, ViewerPageSkeleton } from "./skeletons";

/**
 * The loading state of everything under /admin/subscribers/<id>. Next shows
 * the family segment's loading.tsx for the family page AND for its child
 * routes (health, a meal plan, a program), so the shape is picked from the
 * path being opened — opening the health page from the household tab must
 * not flash the family page's head and tabs. A tab switch never shows this
 * (the family page stays on screen while its next tab streams in).
 */
export function SubscriberRouteSkeleton({
  labels,
}: {
  /** Screen-reader status: the family page's, and the other views'. */
  labels: { family: string; view: string };
}) {
  const kind = subscriberRouteKind(usePathname() ?? "");
  if (kind === "health") return <HealthPageSkeleton label={labels.view} />;
  if (kind === "viewer") return <ViewerPageSkeleton label={labels.view} />;
  return <FamilyPageSkeleton label={labels.family} />;
}
