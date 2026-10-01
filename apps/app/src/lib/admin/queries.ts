import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { adminDb } from "@/lib/admin/db";
import {
  ADMIN_DATASET_TAG,
  ADMIN_DATASET_TTL_SECONDS,
  ADMIN_EMAIL_MAP_TAG,
  ADMIN_EMAIL_TTL_SECONDS,
  readWithinMaxAge,
} from "@/lib/admin/freshness";
import {
  MEAL_PROBE_ROW_COLUMNS,
  finiteNumber,
  mealCellFromRows,
  mealProbeIdsNeeded,
  withProbe,
  type MealProbeRow,
} from "@/lib/admin/mealProjection";
import { workoutCellFromRows, type WorkoutRowLite } from "@/lib/admin/workoutProjection";
import { familyStateOf, newestGenerationByKind } from "@/lib/admin/familyFlags";
import type { FamilyRow } from "@/lib/admin/console-types";
import { computeMrr } from "@/lib/admin/revenue";
import { trend, type Trend } from "@/lib/admin/period";
import {
  computeActiveUserIds,
  computeAiCostInRange,
  computeAiCostSeries,
  computeBeneficiaryTotal,
  computeMemberSlicesInRange,
  computeMetricView,
  computePlanCountInRange,
  makeBuckets,
  parseMetric,
  parseMetrics,
  priorRangeOf,
  resolveRange,
  shiftBuckets,
  toYmd,
} from "@/lib/admin/timeseries";
import type { OverviewView, SubscriberRow } from "@/lib/admin/types";

/**
 * Admin data layer. All reads go through the service-role client (RLS bypass),
 * server-side only.
 *
 * Strategy: for an early-stage subscriber base we load the relevant tables once
 * and aggregate in memory — this keeps the code simple and avoids adding DB
 * functions (the spec forbids schema changes beyond the two admin tables).
 * Every fetch is fully paginated (Supabase caps a single response at ~1000
 * rows); if a hard safety ceiling is ever hit we record it in `dataset.truncated`
 * and the UI surfaces it rather than silently undercounting.
 *
 * When the subscriber base outgrows in-memory aggregation, the compute
 * functions below are pure and can be reimplemented over SQL/RPC without
 * touching the UI.
 */

export const PAGE = 1000;
export const ROW_CEILING = 100_000;

type ReadResult<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;

/**
 * Every row of a range-paged read (LIMIT/OFFSET). Fine for one family's rows
 * and plain columns; the dataset pages by key instead (`paginateById`), since
 * Postgres builds every row an OFFSET skips — projections included.
 */
export async function paginate<Row>(
  build: (from: number, to: number) => ReadResult<Row>,
  label: string,
  onTruncate: (label: string) => void,
): Promise<Row[]> {
  const rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`admin load ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (rows.length >= ROW_CEILING) {
      onTruncate(label);
      break;
    }
  }
  return rows;
}

/**
 * Every row of a whole-table read, a page at a time by key: each page is the
 * next PAGE rows after the last id seen (`afterId`, null for the first). No
 * OFFSET, so no page re-reads the rows before it — with LIMIT/OFFSET page k
 * scans (and projects) every earlier page again, which grows with the square
 * of the table. Rows come back in id order; callers sort as they need.
 */
export async function paginateById<Row extends { id: string }>(
  build: (afterId: string | null) => ReadResult<Row>,
  label: string,
  onTruncate: (label: string) => void,
): Promise<Row[]> {
  const rows: Row[] = [];
  let afterId: string | null = null;
  for (;;) {
    const { data, error } = await build(afterId);
    if (error) throw new Error(`admin load ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    const last = batch[batch.length - 1];
    if (batch.length < PAGE || !last) break;
    afterId = last.id;
    if (rows.length >= ROW_CEILING) {
      onTruncate(label);
      break;
    }
  }
  return rows;
}

/** The part of a query builder `keysetPage` drives (structural, for any table). */
interface KeysetQuery<Q> {
  gt(column: "id", value: string): Q;
  order(column: "id", options: { ascending: boolean }): Q;
  limit(count: number): Q;
}

/** One `paginateById` page: the rows after `afterId`, in id order. */
function keysetPage<Q extends KeysetQuery<Q>>(query: Q, afterId: string | null): Q {
  return (afterId === null ? query : query.gt("id", afterId))
    .order("id", { ascending: true })
    .limit(PAGE);
}

/** How many reads of one batch run at once. */
const READ_CONCURRENCY = 4;

/**
 * `run` over every item, at most READ_CONCURRENCY at a time; results in the
 * order of `items`. The first failure rejects the whole batch.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>,
  limit: number = READ_CONCURRENCY,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await run(items[i]!);
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}

/** Ids per `.in()` read: they ride in the URL, so stay well under a gateway's limit. */
export const ID_CHUNK = 100;

/**
 * Rows by id, in bounded chunks — a few reads at a time, never OFFSET. The
 * order of the result is not the order of `ids`.
 */
export async function readByIdChunks<Row>(
  ids: readonly string[],
  read: (chunk: string[]) => ReadResult<Row>,
  label: string,
): Promise<Row[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const pages = await mapWithConcurrency(chunks, async (chunk) => {
    const { data, error } = await read(chunk);
    if (error) throw new Error(`admin load ${label}: ${error.message}`);
    return data ?? [];
  });
  return pages.flat();
}

interface ProfileLite {
  id: string;
  display_name: string | null;
  preferred_language: string;
  created_at: string;
  onboarding_completed_at: string | null;
  family_wide_completed_at: string | null;
  mom_profile_completed_at: string | null;
}
interface SubscriptionLite {
  user_id: string;
  tier: string | null;
  status: string | null;
  cadence: string | null;
  created_at: string;
  updated_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  /** LemonSqueezy's paid-through date on a cancelled subscription (subscriptionCancelState). */
  ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  lemonsqueezy_subscription_id: string | null;
}
interface MemberLite {
  user_id: string;
  role: string;
}
interface PlanLite {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}
/**
 * The probes of a meal_plans row that decides what its household is served
 * (`mealProbeIdsNeeded`): JSON-path values instead of the blob.
 */
export type PlanProbeLite = MealProbeRow;
interface WorkoutPlanLite {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}
/**
 * A plan_generations row, as lean as its readers allow: the run flags read
 * the kind, status and date of the newest run; the costs read cost and date.
 */
interface GenLite {
  user_id: string;
  /** 'meal' | 'workout' (00014; null on a pre-00014 row = meal). */
  plan_kind: string | null;
  cost_usd: number | null;
  created_at: string;
  status: string;
}
interface ChatLite {
  user_id: string;
  cost_usd: number | null;
  created_at: string;
}

export interface AdminDataset {
  profiles: ProfileLite[];
  /** Newest first (created_at desc, id asc) — the first row per user is their subscription. */
  subscriptions: SubscriptionLite[];
  members: MemberLite[];
  plans: PlanLite[];
  /** Probes of the rows that decide what each household is served (see PlanProbeLite). */
  planProbes: PlanProbeLite[];
  workoutPlans: WorkoutPlanLite[];
  generations: GenLite[];
  chats: ChatLite[];
  emailByUser: Map<string, string | null>;
  /** Tables where the safety ceiling was hit (counts may undercount). */
  truncated: string[];
  /**
   * When the read began (ISO). Every time-dependent cell is judged at this
   * instant (buildFamilyRows), and the snapshot is never served once it is
   * more than two TTLs old (freshness.ts).
   */
  loadedAt: string;
}

async function loadEmailMap(
  onTruncate: (label: string) => void,
): Promise<Map<string, string | null>> {
  const db = adminDb();
  const map = new Map<string, string | null>();
  const perPage = 1000;
  // GoTrue may return fewer rows than `perPage` (it caps page size), so we can't
  // use "short page" as the end signal — terminate on an EMPTY page instead.
  const MAX_PAGES = 500;
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`admin load emails: ${error.message}`);
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) map.set(u.id, u.email ?? null);
    if (page >= MAX_PAGES) {
      onTruncate("emails");
      break;
    }
  }
  return map;
}

const groupBy = <T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
};

const newestFirst = <R extends { id: string; created_at: string }>(rows: readonly R[]): R[] =>
  [...rows].sort((a, b) => {
    const d = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (d) return d;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

/**
 * The probes of the meal plans that decide what each household is served —
 * the second step of the two-step read. The cheap columns of every plan are
 * already in hand; from them, `mealProbeIdsNeeded` names the rows whose
 * probes can matter: each household's newest row, and — only for the
 * households whose newest run died with nothing to show — the older 'ready'
 * rows getLatestPlan's fallback looks through (asked for in the first round
 * when the newest row is a raw failure, in the second once its probes show
 * an empty shell). Each round reads just those ids, in chunks. A probe
 * detoasts the whole blob, so reading them for every recent plan (each
 * superseded week, chain hop and refill) cost far more than the list needs;
 * this reads about one row per household.
 *
 * `nowMs` is the dataset's own read time, the instant buildFamilyRows judges
 * staleness at, so the rows read here are exactly the ones its decision uses.
 */
async function readServedPlanProbes(
  db: ReturnType<typeof adminDb>,
  plans: readonly PlanLite[],
  nowMs: number,
): Promise<PlanProbeLite[]> {
  const households = [...groupBy(plans, (p) => p.user_id).values()].map(newestFirst);
  const probeById = new Map<string, PlanProbeLite>();
  for (let round = 0; round < 2; round += 1) {
    const ids = households.flatMap((rows) =>
      mealProbeIdsNeeded(
        rows.map((p) => withProbe(p, probeById.get(p.id))),
        nowMs,
      ),
    );
    if (ids.length === 0) break;
    const probes = await readByIdChunks(
      ids,
      (chunk) =>
        db
          .from("meal_plans")
          .select(MEAL_PROBE_ROW_COLUMNS)
          .in("id", chunk)
          .returns<PlanProbeLite[]>(),
      "meal_plan_probes",
    );
    for (const p of probes) probeById.set(p.id, p);
  }
  return [...probeById.values()];
}

async function fetchAdminDataset(): Promise<AdminDatasetCacheable> {
  const db = adminDb();
  const readAt = Date.now();
  const truncated: string[] = [];
  const onTruncate = (label: string) => {
    if (!truncated.includes(label)) truncated.push(label);
  };

  const plansRead = paginateById<PlanLite>(
    (after) => keysetPage(db.from("meal_plans").select("id, user_id, status, created_at"), after),
    "meal_plans",
    onTruncate,
  );

  const [
    profiles,
    subscriptions,
    members,
    plans,
    planProbes,
    workoutPlans,
    generations,
    chats,
  ] = await Promise.all([
    paginateById<ProfileLite>(
      (after) =>
        keysetPage(
          db
            .from("profiles")
            .select(
              "id, display_name, preferred_language, created_at, onboarding_completed_at, family_wide_completed_at, mom_profile_completed_at",
            ),
          after,
        ),
      "profiles",
      onTruncate,
    ),
    paginateById<SubscriptionLite & { id: string }>(
      (after) =>
        keysetPage(
          db
            .from("subscriptions")
            .select(
              "id, user_id, tier, status, cadence, created_at, updated_at, trial_started_at, trial_ends_at, current_period_end, ends_at, cancel_at_period_end, cancelled_at, lemonsqueezy_subscription_id",
            ),
          after,
        ),
      "subscriptions",
      onTruncate,
    ).then((rows) =>
      // Newest first, ties by id: the first row per user is the one that counts.
      [...rows]
        .sort(
          (a, b) =>
            Date.parse(b.created_at) - Date.parse(a.created_at) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )
        .map(({ id: _id, ...s }) => s),
    ),
    paginateById<MemberLite & { id: string }>(
      (after) => keysetPage(db.from("family_members").select("id, user_id, role"), after),
      "family_members",
      onTruncate,
    ).then((rows) => rows.map((m) => ({ user_id: m.user_id, role: m.role }))),
    plansRead,
    plansRead.then((rows) => readServedPlanProbes(db, rows, readAt)),
    paginateById<WorkoutPlanLite>(
      (after) =>
        keysetPage(
          db.from("workout_plans").select("id, user_id, status, created_at, updated_at"),
          after,
        ),
      "workout_plans",
      onTruncate,
    ),
    paginateById<GenLite & { id: string }>(
      (after) =>
        keysetPage(
          db
            .from("plan_generations")
            .select("id, user_id, plan_kind, cost_usd, created_at, status"),
          after,
        ),
      "plan_generations",
      onTruncate,
    ),
    paginateById<ChatLite & { id: string }>(
      (after) =>
        keysetPage(db.from("chat_messages").select("id, user_id, cost_usd, created_at"), after),
      "chat_messages",
      onTruncate,
    ),
  ]);

  // The ids were only the page keys; the cached value keeps what its readers
  // read. Postgres numeric can arrive as a string; every cost sum assumes a number.
  return {
    profiles,
    subscriptions,
    members,
    plans,
    planProbes,
    workoutPlans,
    generations: generations.map((g) => ({
      user_id: g.user_id,
      plan_kind: g.plan_kind,
      cost_usd: finiteNumber(g.cost_usd),
      created_at: g.created_at,
      status: g.status,
    })),
    chats: chats.map((c) => ({
      user_id: c.user_id,
      cost_usd: finiteNumber(c.cost_usd),
      created_at: c.created_at,
    })),
    truncated,
    loadedAt: new Date(readAt).toISOString(),
  };
}

/**
 * The admin dataset is request-independent (service-role client, no cookies/headers),
 * so cache it globally for a short window. The admin layout is `force-dynamic`, so
 * WITHOUT this every navigation — including the header toggles (currency / locale)
 * and the chart's granularity links — re-ran the full multi-table fetch (~1–3s). The
 * per-request view computation + formatting stay OUTSIDE the cache, so locale /
 * currency / range still apply live. `revalidateTag("admin-dataset")` force-refreshes.
 * An entry is served for at most two TTLs (loadAdminDataset; freshness.ts).
 */

/** JSON-safe shape stored in the cache: the tables + loadedAt (emails are cached separately). */
type AdminDatasetCacheable = Omit<AdminDataset, "emailByUser">;

const cachedAdminDataset = unstable_cache(
  fetchAdminDataset,
  // v2: the console rebuild added plan ids, meal-plan probes, workout plans and
  // generation kinds; v3: subscriptions.ends_at (the cancellation rule); v4:
  // probes only for the rows that decide the served plan, leaner generation
  // rows, loadedAt = when the read began. A new key part keeps a cache entry
  // written in an older shape from ever being read by the new builders.
  ["admin-dataset", "v4"],
  { revalidate: ADMIN_DATASET_TTL_SECONDS, tags: [ADMIN_DATASET_TAG] },
);

// Emails come from GoTrue (`loadEmailMap` paginates ALL users — the part that scales
// worst), yet they change rarely and are used only by the families list's rows (and so
// its search and the ⌘K index). Cache them SEPARATELY on a longer TTL so the per-minute
// dataset refresh never pays the GoTrue pagination. Entries array, not a Map: a Map
// serializes to `{}` under unstable_cache.
interface EmailEntries {
  entries: Array<[string, string | null]>;
  truncated: boolean;
  /** When the read began (ISO): the entry is served for at most two TTLs. */
  loadedAt: string;
}

async function fetchEmailEntries(): Promise<EmailEntries> {
  const loadedAt = new Date().toISOString();
  let truncated = false;
  const map = await loadEmailMap(() => {
    truncated = true;
  });
  return { entries: [...map], truncated, loadedAt };
}

const cachedEmailEntries = unstable_cache(fetchEmailEntries, ["admin-email-map", "v2"], {
  revalidate: ADMIN_EMAIL_TTL_SECONDS,
  tags: [ADMIN_EMAIL_MAP_TAG],
});

/**
 * The dataset for this request. `cache()` makes every caller in one render
 * (the console frame's rail counts, the overview, the families page) share one
 * read of the two unstable_cache entries and one rebuilt Map.
 *
 * unstable_cache is stale-while-revalidate: past its TTL it still returns the
 * old entry and refreshes it in the background, however old that entry is —
 * and in a low-traffic console the first load after a quiet spell gets one
 * that is hours old. So an entry more than two TTLs old is not served: this
 * request reads for itself, while the background refresh it set off brings
 * the cache up to date for the next one (readWithinMaxAge).
 */
export const loadAdminDataset = cache(async (): Promise<AdminDataset> => {
  const [base, email] = await Promise.all([
    readWithinMaxAge(cachedAdminDataset, fetchAdminDataset, ADMIN_DATASET_TTL_SECONDS),
    readWithinMaxAge(cachedEmailEntries, fetchEmailEntries, ADMIN_EMAIL_TTL_SECONDS),
  ]);
  // Rebuild the Map on this side of the cache so every consumer still gets a real
  // Map (`.get`), not the `{}` a serialized Map would degrade to.
  return {
    ...base,
    emailByUser: new Map(email.entries),
    truncated: email.truncated ? [...base.truncated, "emails"] : base.truncated,
  };
});

// ---------------------------------------------------------------------------
// Aggregation (pure over the dataset)
// ---------------------------------------------------------------------------

/** Most-recent subscription per user (subscriptions are pre-sorted desc). */
function subscriptionByUser(ds: AdminDataset): Map<string, SubscriptionLite> {
  const map = new Map<string, SubscriptionLite>();
  for (const s of ds.subscriptions) {
    if (!map.has(s.user_id)) map.set(s.user_id, s);
  }
  return map;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

const roundUsd = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/** What `subscriberRowOf` reads about one family — from the dataset, or from the family's own rows. */
export interface SubscriberRowInput {
  profile: Pick<ProfileLite, "id" | "display_name" | "created_at" | "onboarding_completed_at">;
  /** The family's latest subscription, if any. */
  subscription: Pick<
    SubscriptionLite,
    | "tier"
    | "status"
    | "cadence"
    | "trial_ends_at"
    | "current_period_end"
    | "ends_at"
    | "cancel_at_period_end"
  > | null;
  email: string | null;
  members: ReadonlyArray<{ role: string }>;
  /** Every meal_plans row (archived ones too: they were generated). */
  plans: ReadonlyArray<{ status: string; created_at: string }>;
  /** Sum of the family's generation runs' cost (USD). */
  generationCostUsd: number;
  /** The family's advisor chat: total cost (USD) and the newest message. */
  chat: { costUsd: number; lastAt: string | null };
}

/**
 * The account + billing half of a family's row: household size and the tier
 * limit, plan counts, last activity, lifetime AI cost. ONE definition, used
 * by the families list (buildFamilyRows, over the dataset) and by the family
 * page's header (lib/admin/family.ts, over that family's own rows), so the
 * two cannot count a family differently.
 */
export function subscriberRowOf(input: SubscriberRowInput): SubscriberRow {
  const { profile: p, subscription: sub, members, plans, chat } = input;
  const nonHousekeeper = members.filter((m) => m.role !== "housekeeper").length;
  const beneficiaries = 1 + nonHousekeeper; // owner + dependents
  const hasHousekeeper = members.some((m) => m.role === "housekeeper");

  const tierDef = sub?.tier && sub.tier in PRICING_TIERS ? PRICING_TIERS[sub.tier as Tier] : null;
  const overLimit = tierDef?.max_people != null && beneficiaries > tierDef.max_people;

  let lastActivityAt: string | null = chat.lastAt;
  for (const pl of plans) lastActivityAt = maxIso(lastActivityAt, pl.created_at);

  return {
    userId: p.id,
    displayName: p.display_name,
    email: input.email,
    tier: sub?.tier ?? null,
    status: sub?.status ?? null,
    cadence: sub?.cadence ?? null,
    signupAt: p.created_at,
    trialEndsAt: sub?.trial_ends_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    endsAt: sub?.ends_at ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    beneficiaries,
    hasHousekeeper,
    overLimit,
    plansGenerated: plans.length,
    failedPlans: plans.filter((pl) => pl.status === "failed").length,
    lastActivityAt,
    lifetimeAiCostUsd: roundUsd(input.generationCostUsd + chat.costUsd),
    onboardingComplete: p.onboarding_completed_at != null,
  };
}

/** A family's chat: total cost and the newest message. */
function chatTotals(chats: readonly ChatLite[]): { costUsd: number; lastAt: string | null } {
  let costUsd = 0;
  let lastAt: string | null = null;
  for (const c of chats) {
    costUsd += c.cost_usd ?? 0;
    lastAt = maxIso(lastAt, c.created_at);
  }
  return { costUsd, lastAt };
}

// ---------------------------------------------------------------------------
// Families list rows (pure over the dataset)
// ---------------------------------------------------------------------------

/**
 * The families list: every SubscriberRow field, plus what each household is
 * actually served (meal + exercise, by the app's own getLatestPlan /
 * getLatestWorkoutPlan rules — see mealProjection.ts / workoutProjection.ts),
 * the subscription's cancellation state and the attention flags.
 *
 * The meal cell is the probe approximation (mealCellFromRows: the first
 * beneficiary stands in for the household); the family page and panel decide
 * the same question on the plan's blob. Every other part of a row — counts,
 * costs, flags, the cancellation state — is built by the same functions the
 * family header uses (subscriberRowOf, familyStateOf).
 *
 * `nowMs` defaults to when the dataset was READ, not the wall clock: judging
 * a snapshot's "silence since the last write" against a later clock would call
 * a live run stale before the snapshot could know. The snapshot itself is at
 * most two TTLs old when it is served (loadAdminDataset), so that instant is
 * always recent. The cancellation state is judged at the same instant as the
 * flags, so a row's cancel_scheduled flag and its views never disagree.
 */
export function buildFamilyRows(
  ds: AdminDataset,
  nowMs: number = Date.parse(ds.loadedAt) || Date.now(),
): FamilyRow[] {
  const subByUser = subscriptionByUser(ds);
  const membersByUser = groupBy(ds.members, (m) => m.user_id);
  const plansByUser = groupBy(ds.plans, (p) => p.user_id);
  // Defensive `?? []`: a dataset cached by the previous deploy lacks these.
  const probeById = new Map((ds.planProbes ?? []).map((p) => [p.id, p]));
  const workoutsByUser = groupBy(ds.workoutPlans ?? [], (w) => w.user_id);
  const gensByUser = groupBy(ds.generations, (g) => g.user_id);
  const chatByUser = groupBy(ds.chats, (c) => c.user_id);

  return ds.profiles.map((p) => {
    const plans = plansByUser.get(p.id) ?? [];
    const gens = gensByUser.get(p.id) ?? [];
    const row = subscriberRowOf({
      profile: p,
      subscription: subByUser.get(p.id) ?? null,
      email: ds.emailByUser.get(p.id) ?? null,
      members: membersByUser.get(p.id) ?? [],
      plans,
      generationCostUsd: gens.reduce((s, g) => s + (g.cost_usd ?? 0), 0),
      chat: chatTotals(chatByUser.get(p.id) ?? []),
    });
    const meal = mealCellFromRows(
      newestFirst(plans).map((pl) => withProbe(pl, probeById.get(pl.id))),
      nowMs,
    );
    const workoutRows: WorkoutRowLite[] = newestFirst(workoutsByUser.get(p.id) ?? []);
    const workout = workoutCellFromRows(workoutRows, nowMs);
    return {
      ...row,
      meal,
      workout,
      ...familyStateOf({ row, meal, workout, newestRun: newestGenerationByKind(gens), nowMs }),
    } satisfies FamilyRow;
  });
}

export interface FamilyListData {
  rows: FamilyRow[];
  /** When the underlying dataset was read (ISO). */
  loadedAt: string;
  /** Tables where the row ceiling was hit — counts may undercount. */
  truncated: string[];
}

/**
 * The families list for this request. The console frame (rail counts, ⌘K
 * index) and the families page both read it; `cache()` builds it once.
 */
export const loadFamilyList = cache(async (): Promise<FamilyListData> => {
  const ds = await loadAdminDataset();
  return {
    rows: buildFamilyRows(ds),
    loadedAt: ds.loadedAt ?? new Date().toISOString(),
    truncated: ds.truncated,
  };
});

const DAY_MS = 86_400_000;

/**
 * Build the Overview's data, scoped to the URL-selected range: every shown
 * metric's series with its comparison window (the metric tiles and the chart,
 * _overview/MetricBoard) plus the AI-cost figures (_overview/CostTiles);
 * _overview/model.ts formats it. All series are snapshot reconstructions (see
 * lib/admin/timeseries.ts) so `approximated: true`; the AI-cost figures are
 * exact. Reuses the single overview dataset load.
 */
export function buildOverviewView(
  ds: AdminDataset,
  params: {
    metric?: string;
    metrics?: string;
    range?: string;
    from?: string;
    to?: string;
    interval?: string;
    cmp?: string;
  },
  now: Date = new Date(),
): OverviewView {
  const subs = [...subscriptionByUser(ds).values()];
  const selectedMetric = parseMetric(params.metric);
  const shownMetrics = parseMetrics(params.metrics);
  const comparisonOn = params.cmp !== "off";

  const { range, preset, interval } = resolveRange(params, now);
  const curBuckets = makeBuckets(range, interval);
  const dur = range.end.getTime() - range.start.getTime();
  const priorBuckets = shiftBuckets(curBuckets, dur);
  const priorRange = priorRangeOf(range);

  // Compute views for the shown tabs plus the selected metric (deduped).
  const profilesLite = ds.profiles.map((p) => ({ created_at: p.created_at }));
  const toCompute = [...new Set([...shownMetrics, selectedMetric])];
  const metrics = toCompute.map((m) =>
    computeMetricView(m, subs, profilesLite, curBuckets, priorBuckets, comparisonOn),
  );

  // ── AI-cost strip (exact, range-scoped) ──
  const totalActive = subs.filter((s) => s.status === "active").length;
  const subscriberCount = ds.profiles.length;
  const beneficiaryTotal = computeBeneficiaryTotal(subscriberCount, ds.members);
  const aiCostUsd = computeAiCostInRange(ds.generations, ds.chats, range);
  const aiCostSeries = computeAiCostSeries(ds.generations, ds.chats, curBuckets);
  const aiCostPriorUsd = comparisonOn
    ? computeAiCostInRange(ds.generations, ds.chats, priorRange)
    : 0;
  const aiCostDelta: Trend = comparisonOn
    ? trend(aiCostUsd, aiCostPriorUsd)
    : { pct: null, direction: "flat" };
  // Accounts that actually used AI in the range — the denominators for the cost
  // averages (dividing the period's spend by all-time accounts would dilute it
  // with every account that never used AI).
  const activeUserIds = computeActiveUserIds(ds.generations, ds.chats, range);
  const activeUsersInRange = activeUserIds.size;
  // Beneficiaries of those active accounts: owner + their non-housekeeper members.
  const activeBeneficiaryTotal =
    activeUsersInRange +
    ds.members.filter((m) => m.role !== "housekeeper" && activeUserIds.has(m.user_id))
      .length;

  // "% of revenue": MRR(USD) prorated to the range length (est.).
  const mrr = computeMrr(
    subs.filter((s) => s.status === "active").map((s) => ({ tier: s.tier, cadence: s.cadence })),
  );
  const rangeDays = Math.max(1, dur / DAY_MS);
  const revenueInRangeUsd = mrr.mrrUsd * (rangeDays / 30);
  const aiPctOfRevenue =
    revenueInRangeUsd > 0 ? Math.round((aiCostUsd / revenueInRangeUsd) * 1000) / 10 : null;
  const aiCostPerAccountUsd =
    activeUsersInRange > 0
      ? Math.round((aiCostUsd / activeUsersInRange) * 10000) / 10000
      : null;
  const aiCostPerMemberUsd =
    activeBeneficiaryTotal > 0
      ? Math.round((aiCostUsd / activeBeneficiaryTotal) * 10000) / 10000
      : null;
  // Per plan: the cost of GENERATING plans ÷ plans generated in the period. The
  // numerator is generation-only (plan_generations spend, incl. translation rows) —
  // NOT aiCostUsd, which also includes the AI chat assistant (chat_messages), a
  // separate feature that has nothing to do with producing a plan.
  const generationCostInRange = computeAiCostInRange(ds.generations, [], range);
  const planCountInRange = computePlanCountInRange(ds.plans, range);
  const aiCostPerPlanUsd =
    planCountInRange > 0
      ? Math.round((generationCostInRange / planCountInRange) * 10000) / 10000
      : null;
  // Per member plan: generation cost ÷ member-slices (each plan counts its
  // household's beneficiaries) — cost to put one person on one plan.
  const memberSlicesInRange = computeMemberSlicesInRange(ds.plans, ds.members, range);
  const aiCostPerMemberPlanUsd =
    memberSlicesInRange > 0
      ? Math.round((generationCostInRange / memberSlicesInRange) * 10000) / 10000
      : null;

  return {
    subscriberCount,
    totalActive,
    selectedMetric,
    shownMetrics,
    metrics,
    preset,
    interval,
    comparisonOn,
    rangeStartIso: range.start.toISOString(),
    rangeEndIso: range.end.toISOString(),
    priorStartIso: priorRange.start.toISOString(),
    priorEndIso: priorRange.end.toISOString(),
    fromValue: toYmd(range.start),
    // The range end is exclusive; the date input shows the last included day.
    toValue: toYmd(new Date(range.end.getTime() - 1)),
    bucketIsos: curBuckets.map((b) => b.iso),
    aiCostUsd,
    aiCostPerAccountUsd,
    aiCostPerMemberUsd,
    aiCostPerPlanUsd,
    aiCostPerMemberPlanUsd,
    aiPctOfRevenue,
    beneficiaryTotal,
    aiCostSeries,
    aiCostPriorUsd,
    aiCostDelta,
    activeUsersInRange,
    approximated: true,
  };
}
