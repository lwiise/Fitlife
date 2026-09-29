import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getAdminContext } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadFamilyPanel } from "@/lib/admin/family";
import { isFamilyId } from "@/lib/admin/familyList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscriber data: never stored by a browser or shared cache. */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const notFound = () =>
  NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

/**
 * GET /api/admin/families/:userId
 *
 * Everything the families list's side panel shows for one family, in one JSON
 * response (FamilyPanelData): header, served meal plan + week, served exercise
 * program + this week's marks, household. The client caches responses in a Map
 * and prefetches on row focus/hover, so this is the panel's only round trip.
 *
 * Access: admins only. Anyone else gets a 404 — never a 401/403 — so a prober
 * learns nothing about whether the route exists (generation-diagnostics does
 * the same). A malformed id is a 404 before any read.
 *
 * PDPL: every fetch is an audited subscriber-detail view (`surface: "panel"`).
 * The audit insert runs in parallel with the reads, not before them, so it
 * adds no latency; logAdminAccess never throws (a failed insert is logged and
 * reported by audit.ts). No health values are in the payload — only the
 * derived medical-gate booleans.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return notFound();

  const { userId: rawId } = await params;
  if (!isFamilyId(rawId)) return notFound();
  const userId = rawId.toLowerCase();

  try {
    const [, data] = await Promise.all([
      logAdminAccess({
        adminUserId: ctx.userId,
        subscriberId: userId,
        action: "view_subscriber_detail",
        detail: { surface: "panel" },
      }),
      loadFamilyPanel(userId),
    ]);
    if (!data) return notFound();
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin-panel] failed to load family", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, { tags: { area: "admin-panel" } });
    return NextResponse.json({ error: "Failed to load" }, { status: 500, headers: NO_STORE });
  }
}
