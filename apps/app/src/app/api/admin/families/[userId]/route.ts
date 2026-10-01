import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { resolveAdminAccess } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadFamilyPanel } from "@/lib/admin/family";
import { isFamilyId } from "@/lib/admin/familyList";
import { PANEL_FAMILY_GONE, PANEL_NOT_FOUND, PANEL_UNAVAILABLE } from "@/lib/admin/panelResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscriber data: never stored by a browser or shared cache. */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** Anyone but an admin: a 404 that says nothing (generation-diagnostics does the same). */
const notFound = () => NextResponse.json(PANEL_NOT_FOUND, { status: 404, headers: NO_STORE });

/** An admin asked for a family that does not exist: the panel may say so, and remember it. */
const familyGone = () => NextResponse.json(PANEL_FAMILY_GONE, { status: 404, headers: NO_STORE });

/** The admin lookup itself failed: nothing is known about access either way. */
const unavailable = () => NextResponse.json(PANEL_UNAVAILABLE, { status: 503, headers: NO_STORE });

/**
 * GET /api/admin/families/:userId
 *
 * Everything the families list's side panel shows for one family, in one JSON
 * response (FamilyPanelData): header, served meal plan + week, served exercise
 * program + this week's marks, household. The client caches responses in a Map
 * and prefetches on row focus/hover, so this is the panel's only round trip.
 *
 * Access: admins only. Anyone else gets a bare 404 — never a 401/403 — so a
 * prober learns nothing about whether the route exists (generation-diagnostics
 * does the same). Only once the requester is known to be an admin does a
 * missing family get the marked 404 (lib/admin/panelResponse.ts) that lets the
 * panel say the family is gone — so a lapsed session never reads as a deleted
 * family. When the admin lookup itself fails the answer is a 503: try again.
 * A malformed id is a family that cannot exist, answered before any read.
 *
 * PDPL: every fetch is an audited subscriber-detail view (`surface: "panel"`).
 * The audit insert runs in parallel with the reads, not before them, so it
 * adds no latency; logAdminAccess never throws (a failed insert is logged and
 * reported by audit.ts). No health values are in the payload — only the
 * derived medical-gate booleans.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await resolveAdminAccess();
  if (access.kind === "error") return unavailable();
  if (access.kind === "none") return notFound();

  const { userId: rawId } = await params;
  if (!isFamilyId(rawId)) return familyGone();
  const userId = rawId.toLowerCase();

  try {
    const [, data] = await Promise.all([
      logAdminAccess({
        adminUserId: access.ctx.userId,
        subscriberId: userId,
        action: "view_subscriber_detail",
        detail: { surface: "panel" },
      }),
      loadFamilyPanel(userId),
    ]);
    if (!data) return familyGone();
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
