import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { ConsoleNavData, FamilySearchIndex } from "@/lib/admin/console-types";
import { viewCounts } from "@/lib/admin/familyList";
import {
  ADMIN_DATASET_TAG,
  ADMIN_DATASET_TTL_SECONDS,
  ADMIN_EMAIL_MAP_TAG,
  readWithinMaxAge,
} from "@/lib/admin/freshness";
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
 * from the rail counts and from ⌘K on the very next request. And like it,
 * neither is served once it is more than two TTLs old (freshness.ts): past
 * that the request cuts them from the dataset itself.
 */

const TAGS = [ADMIN_DATASET_TAG, ADMIN_EMAIL_MAP_TAG];

async function navSummary(): Promise<ConsoleNavData> {
  const { rows, loadedAt, truncated } = await loadFamilyList();
  return { counts: viewCounts(rows), loadedAt, truncated };
}

// v2: a trial that ran out counts as «ended», not «trialing».
const cachedNavSummary = unstable_cache(navSummary, ["admin-console-nav", "v2"], {
  revalidate: ADMIN_DATASET_TTL_SECONDS,
  tags: TAGS,
});

/** Rail counts for the console frame (no family is named in it). */
export const loadConsoleNavData = cache(
  (): Promise<ConsoleNavData> =>
    readWithinMaxAge(cachedNavSummary, navSummary, ADMIN_DATASET_TTL_SECONDS),
);

async function searchIndex(): Promise<FamilySearchIndex> {
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
}

const cachedSearchIndex = unstable_cache(searchIndex, ["admin-family-search-index", "v1"], {
  revalidate: ADMIN_DATASET_TTL_SECONDS,
  tags: TAGS,
});

/**
 * Every family for the command palette. Subscriber data: only the audited
 * GET /api/admin/families may hand it to a browser.
 */
export const loadFamilySearchIndex = cache(
  (): Promise<FamilySearchIndex> =>
    readWithinMaxAge(cachedSearchIndex, searchIndex, ADMIN_DATASET_TTL_SECONDS),
);
