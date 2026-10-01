import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getAdminContext } from "@/lib/admin/auth";
import { logAdminAccess } from "@/lib/admin/audit";
import { loadFamilySearchIndex } from "@/lib/admin/consoleNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscriber data: never stored by a browser or shared cache. */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * GET /api/admin/families
 *
 * The command palette's family index: every family's id, name and email
 * (FamilySearchIndex). ⌘K fetches it the first time it opens — it is never
 * part of a page's payload, so a family page, a plan view or a 404 sends no
 * other family's details to the browser.
 *
 * Access: admins only. Anyone else gets a 404 — never a 401/403 — like the
 * panel route and generation-diagnostics, so a prober learns nothing.
 *
 * PDPL: every fetch is an audited subscriber-list view
 * (`view_subscriber_list`, `section: "palette"`) carrying how many families
 * it disclosed. The row is written before the response goes out — a dropped
 * audit row is a PDPL regression — and it waits only on the index read,
 * which is a cache hit almost always, so the insert is the only round trip
 * the response waits for. A failed read discloses nothing and records
 * nothing; logAdminAccess never throws.
 */
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  try {
    const index = await loadFamilySearchIndex();
    await logAdminAccess({
      adminUserId: ctx.userId,
      action: "view_subscriber_list",
      detail: { section: "palette", total: index.families.length },
    });
    return NextResponse.json(index, { headers: NO_STORE });
  } catch (err) {
    console.error("[admin-palette] failed to load the family index", {
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, { tags: { area: "admin-palette" } });
    return NextResponse.json({ error: "Failed to load" }, { status: 500, headers: NO_STORE });
  }
}
