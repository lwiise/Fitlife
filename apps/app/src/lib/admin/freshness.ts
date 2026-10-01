/**
 * How old the console's cached snapshots may be, and when the families list
 * asks for a newer one. Pure and client-safe: the server loaders (queries.ts,
 * consoleNav.ts) and the families console in the browser read the same
 * numbers.
 *
 * The admin dataset is cached with `unstable_cache`, which is
 * stale-while-revalidate: once an entry is past its TTL, the next request is
 * still handed the OLD entry while a refresh runs in the background. The
 * console is low-traffic, so "the next request" is routinely the first load
 * after a quiet spell, and the entry it gets can be hours old. Every
 * time-dependent cell (a run gone silent, a trial that ran out, a scheduled
 * cancellation) is judged at the snapshot's own read time, so serving an old
 * snapshot is not just stale numbers: it is a list that says «جارٍ الإنشاء»
 * for a run the live panel already calls failed.
 *
 * So a cached snapshot is served only while it is at most twice its TTL old
 * (`servable`); past that, the request reads for itself. Between one and two
 * TTLs the cached entry is still served, while unstable_cache refreshes it in
 * the background — the case stale-while-revalidate is for.
 */

/** The admin dataset and everything cut from it (rail counts, ⌘K index, engagement). */
export const ADMIN_DATASET_TTL_SECONDS = 60;

/** GoTrue's email list: it changes rarely and is the read that scales worst. */
export const ADMIN_EMAIL_TTL_SECONDS = 300;

/** A cached snapshot is served until it is this many TTLs old. */
export const MAX_SERVED_TTLS = 2;

/** The oldest a snapshot cached for `ttlSeconds` may be when it is served. */
export function maxServedAgeMs(ttlSeconds: number): number {
  return ttlSeconds * 1000 * MAX_SERVED_TTLS;
}

/**
 * How old a snapshot read at `loadedAt` is at `nowMs`. A missing or
 * unreadable time is infinitely old: a snapshot that cannot say when it was
 * read is never trusted to be recent.
 */
export function snapshotAgeMs(loadedAt: string | null | undefined, nowMs: number): number {
  if (!loadedAt) return Infinity;
  const at = Date.parse(loadedAt);
  return Number.isNaN(at) ? Infinity : nowMs - at;
}

/** May a snapshot cached for `ttlSeconds` and read at `loadedAt` be served at `nowMs`? */
export function servable(
  loadedAt: string | null | undefined,
  ttlSeconds: number,
  nowMs: number,
): boolean {
  return snapshotAgeMs(loadedAt, nowMs) <= maxServedAgeMs(ttlSeconds);
}

/**
 * The cached snapshot, unless it is too old to serve — then a fresh read.
 *
 * On a hit past the TTL, unstable_cache has already set off its background
 * refresh before handing back the old entry; that refresh still lands, so
 * the next request is served from the cache again. This request does not
 * wait for it (it cannot be awaited) and reads for itself — two reads, but
 * only on the first request after a quiet spell of more than two TTLs.
 */
export async function readWithinMaxAge<T extends { loadedAt?: string | null }>(
  cached: () => Promise<T>,
  fresh: () => Promise<T>,
  ttlSeconds: number,
  now: () => number = Date.now,
): Promise<T> {
  const hit = await cached();
  return servable(hit.loadedAt, ttlSeconds, now()) ? hit : fresh();
}

// ── Cache tags ───────────────────────────────────────────────────────────────

export const ADMIN_DATASET_TAG = "admin-dataset";
export const ADMIN_EMAIL_MAP_TAG = "admin-email-map";
export const ADMIN_ENGAGEMENT_TAG = "admin-engagement";

/**
 * Every cached admin read that can hold one household's data: the dataset
 * (and the rail counts and ⌘K index cut from it), the email list, and the
 * engagement counters (its check-ins, verdicts, weigh-ins and paid
 * subscription). Erasing an account expires all of them, so the erased
 * household is gone from every surface on the very next request.
 */
export const ADMIN_HOUSEHOLD_CACHE_TAGS = [
  ADMIN_DATASET_TAG,
  ADMIN_EMAIL_MAP_TAG,
  ADMIN_ENGAGEMENT_TAG,
] as const;

// ── The families list in the browser ─────────────────────────────────────────

export interface QuietRefreshInput {
  /**
   * How old the list's data was when the server rendered the page: the
   * render's time minus the dataset's read time — both server clocks, so a
   * skewed device clock cannot make fresh data look old or old data fresh.
   */
  ageAtRenderMs: number;
  /** Browser time elapsed since that render reached the page. */
  sinceRenderMs: number;
  /** Browser time since this page last asked for a refresh (Infinity: never). */
  sinceLastAttemptMs: number;
}

/**
 * The families list is client state: search, filters, sort and paging never
 * go back to the server, so without help an open tab shows the data it was
 * loaded with for as long as it stays open. When the operator comes back to
 * the tab and the data is older than the cache's TTL, the page refreshes
 * itself quietly (a newer snapshot exists, or the server reads one).
 *
 * At most one attempt per TTL: the refresh re-renders the page — an audited
 * list view — and if the server still holds the same snapshot (it is between
 * one and two TTLs old and refreshing in the background) the next return to
 * the tab picks up the new one.
 */
export function shouldQuietRefresh(input: QuietRefreshInput): boolean {
  const ttlMs = ADMIN_DATASET_TTL_SECONDS * 1000;
  const age = input.ageAtRenderMs + Math.max(0, input.sinceRenderMs);
  return Number.isFinite(age) && age > ttlMs && input.sinceLastAttemptMs > ttlMs;
}
