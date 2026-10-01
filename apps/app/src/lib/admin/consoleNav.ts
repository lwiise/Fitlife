import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { ConsoleNavData, FamilySearchIndex } from "@/lib/admin/console-types";
import { viewCounts } from "@/lib/admin/familyList";
import { loadAdminDataset, loadFamilyList } from "@/lib/admin/queries";

/**
 * The console frame's data, split by who may see it.
 *
 * - The NAV SUMMARY — the rail's view counts, when the data was read, and
 *   whether a table hit the load ceiling — goes out with EVERY console page:
 *   the (console) layout starts it and the rail streams it in. It names no
 *   family, so it needs no audit row. It is also tiny and kept in its own
 *   cache entry, so a family page, a plan view or the health page draws the
 *   rail without parsing the whole admin dataset (tens of MB at scale) and
 *   building a row for every family.
 * - The SEARCH INDEX — every family's id, name and email, for ⌘K — is
 *   subscriber data. It never rides along with a page: the command palette
 *   fetches it from GET /api/admin/families the first time it opens, and that
 *   route records the access (view_subscriber_list, section "palette"). It
 *   has its own cache entry for the same reason as the summary.
 *
 * Both are cut from the 60s dataset (lib/admin/queries.ts) and tagged like it,
 * so an erased account — deleteSubscriberAccount expires both tags — is gone
 * from the rail counts and from ⌘K on the very next request.
 */

const TTL_SECONDS = 60;
const TAGS = ["admin-dataset", "admin-email-map"];

const cachedNavSummary = unstable_cache(
  async (): Promise<ConsoleNavData> => {
    const { rows, loadedAt, truncated } = await loadFamilyList();
    return { counts: viewCounts(rows), loadedAt, truncated };
  },
  ["admin-console-nav", "v1"],
  { revalidate: TTL_SECONDS, tags: TAGS },
);

/** Rail counts for the console frame (no family is named in it). */
export const loadConsoleNavData = cache((): Promise<ConsoleNavData> => cachedNavSummary());

const cachedSearchIndex = unstable_cache(
  async (): Promise<FamilySearchIndex> => {
    // Names and emails only: no row is built, no flag derived.
    const ds = await loadAdminDataset();
    return {
      families: ds.profiles.map((p) => ({
        id: p.id,
        name: p.display_name,
        email: ds.emailByUser.get(p.id) ?? null,
      })),
      loadedAt: ds.loadedAt,
    };
  },
  ["admin-family-search-index", "v1"],
  { revalidate: TTL_SECONDS, tags: TAGS },
);

/**
 * Every family for the command palette. Subscriber data: only the audited
 * GET /api/admin/families may hand it to a browser.
 */
export const loadFamilySearchIndex = cache((): Promise<FamilySearchIndex> => cachedSearchIndex());
