import "server-only";

import { cache } from "react";
import type { FamilyTab } from "@/lib/admin/console-types";
import { logAdminAccess } from "@/lib/admin/audit";
import { adminDb } from "@/lib/admin/db";
import type { SubscriberHealth } from "@/lib/admin/detail";
import {
  loadHousehold,
  loadMealSection,
  loadRuns,
  loadWorkoutSection,
} from "@/lib/admin/family";
import { tabSections, type TabSection } from "./model";

/**
 * Server-side helpers for the family page and its audited views. The family
 * data itself comes from lib/admin/family.ts; this file only adds what those
 * loaders do not carry (a name for the titles and the view pages' crumb, the
 * member count the health page's audit row records) and the tab preload.
 */

const PRELOAD: Readonly<Record<TabSection, (userId: string) => Promise<unknown>>> = {
  meal: loadMealSection,
  workout: loadWorkoutSection,
  household: loadHousehold,
  runs: loadRuns,
};

/**
 * Starts reading what `tab` shows while the page is still waiting for its
 * header, so the body's reads run alongside the header's instead of after it.
 * The loaders are `cache()`d per request: the tab body awaits these same
 * promises. Nothing is awaited here, and a failure is not handled here — it
 * surfaces where the body awaits it (the catch below only keeps a read that
 * fails before anyone awaits it from counting as an unhandled rejection).
 */
export function preloadFamilyTab(userId: string, tab: FamilyTab): void {
  for (const section of tabSections(tab)) {
    PRELOAD[section](userId).catch(() => undefined);
  }
}

/**
 * The family's display name as stored — one small read: "" when the family
 * has none, null when there is no such family or the read failed. The family
 * page's <title> is built from it, so that a tab switch (which re-renders the
 * page, and its title, but not the layout that read the header) costs this
 * one column instead of the header; it tells the two empty cases apart so a
 * nameless family is titled «بدون اسم», as its head names it.
 */
export const loadProfileName = cache(async (userId: string): Promise<string | null> => {
  const { data, error } = await adminDb()
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[admin-family] display name read failed", error.message);
    return null;
  }
  return data ? (data.display_name?.trim() ?? "") : null;
});

/**
 * The family's display name, for the crumb of the plan, program and health
 * pages — run in parallel with the page's own read. Null when there is none
 * or the read failed (the crumb then says «صفحة العائلة»).
 */
export const loadFamilyName = cache(
  async (userId: string): Promise<string | null> => (await loadProfileName(userId)) || null,
);

/** How many family_members rows the family has (the housekeeper included). */
async function countMemberRows(userId: string): Promise<number | null> {
  const { count, error } = await adminDb()
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.warn("[admin-family] member count failed", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * The health page's PDPL audit row — `view_health_detail` with the number of
 * people whose health detail the page shows (unchanged detail: the owner plus
 * every family member). Counted with its own head-only read so the audit
 * write runs ALONGSIDE the health read rather than after it; only if that
 * count fails does it wait for the page's own read and count the cards.
 */
export async function logHealthView(
  adminUserId: string,
  userId: string,
  health: Promise<SubscriberHealth | null>,
): Promise<void> {
  const rows = await countMemberRows(userId);
  const memberCount = rows != null ? rows + 1 : ((await health)?.members.length ?? null);
  await logAdminAccess({
    adminUserId,
    subscriberId: userId,
    action: "view_health_detail",
    detail: { memberCount },
  });
}
