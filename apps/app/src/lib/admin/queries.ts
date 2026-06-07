import "server-only";

import { PRICING_TIERS, type Tier } from "@fitlife/config";
import { adminDb } from "@/lib/admin/db";
import { computeMrr } from "@/lib/admin/revenue";
import { getPeriodPair, inRange, trend, type PeriodPair } from "@/lib/admin/period";
import type {
  Kpi,
  Kpis,
  SubscriberListParams,
  SubscriberListResult,
  SubscriberRow,
  SubscriberSortKey,
} from "@/lib/admin/types";

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

export async function paginate<Row>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
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
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  lemonsqueezy_subscription_id: string | null;
}
interface MemberLite {
  user_id: string;
  role: string;
}
interface PlanLite {
  user_id: string;
  status: string;
  created_at: string;
}
interface GenLite {
  user_id: string;
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
  subscriptions: SubscriptionLite[];
  members: MemberLite[];
  plans: PlanLite[];
  generations: GenLite[];
  chats: ChatLite[];
  emailByUser: Map<string, string | null>;
  /** Tables where the safety ceiling was hit (counts may undercount). */
  truncated: string[];
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

export async function loadAdminDataset(): Promise<AdminDataset> {
  const db = adminDb();
  const truncated: string[] = [];
  const onTruncate = (label: string) => {
    if (!truncated.includes(label)) truncated.push(label);
  };

  const [profiles, subscriptions, members, plans, generations, chats, emailByUser] =
    await Promise.all([
      paginate<ProfileLite>(
        (f, t) =>
          db
            .from("profiles")
            .select(
              "id, display_name, preferred_language, created_at, onboarding_completed_at, family_wide_completed_at, mom_profile_completed_at",
            )
            .range(f, t),
        "profiles",
        onTruncate,
      ),
      paginate<SubscriptionLite>(
        (f, t) =>
          db
            .from("subscriptions")
            .select(
              "user_id, tier, status, cadence, created_at, updated_at, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end, cancelled_at, lemonsqueezy_subscription_id",
            )
            .order("created_at", { ascending: false })
            .range(f, t),
        "subscriptions",
        onTruncate,
      ),
      paginate<MemberLite>(
        (f, t) => db.from("family_members").select("user_id, role").range(f, t),
        "family_members",
        onTruncate,
      ),
      paginate<PlanLite>(
        (f, t) =>
          db.from("meal_plans").select("user_id, status, created_at").range(f, t),
        "meal_plans",
        onTruncate,
      ),
      paginate<GenLite>(
        (f, t) =>
          db
            .from("plan_generations")
            .select("user_id, cost_usd, created_at, status")
            .range(f, t),
        "plan_generations",
        onTruncate,
      ),
      paginate<ChatLite>(
        (f, t) =>
          db.from("chat_messages").select("user_id, cost_usd, created_at").range(f, t),
        "chat_messages",
        onTruncate,
      ),
      loadEmailMap(onTruncate),
    ]);

  return {
    profiles,
    subscriptions,
    members,
    plans,
    generations,
    chats,
    emailByUser,
    truncated,
  };
}

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

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function buildSubscriberRows(ds: AdminDataset): SubscriberRow[] {
  const subByUser = subscriptionByUser(ds);
  const membersByUser = groupBy(ds.members, (m) => m.user_id);
  const plansByUser = groupBy(ds.plans, (p) => p.user_id);
  const genByUser = groupBy(ds.generations, (g) => g.user_id);
  const chatByUser = groupBy(ds.chats, (c) => c.user_id);

  return ds.profiles.map((p) => {
    const sub = subByUser.get(p.id) ?? null;
    const members = membersByUser.get(p.id) ?? [];
    const nonHousekeeper = members.filter((m) => m.role !== "housekeeper").length;
    const beneficiaries = 1 + nonHousekeeper; // owner + dependents
    const hasHousekeeper = members.some((m) => m.role === "housekeeper");

    const tierDef = sub?.tier && sub.tier in PRICING_TIERS
      ? PRICING_TIERS[sub.tier as Tier]
      : null;
    const overLimit =
      tierDef?.max_people != null && beneficiaries > tierDef.max_people;

    const plans = plansByUser.get(p.id) ?? [];
    const gens = genByUser.get(p.id) ?? [];
    const chats = chatByUser.get(p.id) ?? [];

    const lifetimeAiCostUsd =
      gens.reduce((s, g) => s + (g.cost_usd ?? 0), 0) +
      chats.reduce((s, c) => s + (c.cost_usd ?? 0), 0);

    let lastActivityAt: string | null = null;
    for (const c of chats) lastActivityAt = maxIso(lastActivityAt, c.created_at);
    for (const pl of plans) lastActivityAt = maxIso(lastActivityAt, pl.created_at);

    return {
      userId: p.id,
      displayName: p.display_name,
      email: ds.emailByUser.get(p.id) ?? null,
      tier: sub?.tier ?? null,
      status: sub?.status ?? null,
      cadence: sub?.cadence ?? null,
      signupAt: p.created_at,
      trialEndsAt: sub?.trial_ends_at ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      beneficiaries,
      hasHousekeeper,
      overLimit,
      plansGenerated: plans.length,
      failedPlans: plans.filter((pl) => pl.status === "failed").length,
      lastActivityAt,
      lifetimeAiCostUsd: Math.round(lifetimeAiCostUsd * 1_000_000) / 1_000_000,
      onboardingComplete: p.onboarding_completed_at != null,
    } satisfies SubscriberRow;
  });
}

function kpi(current: number, prior: number): Kpi {
  return { value: current, prior, trend: trend(current, prior) };
}

export function computeKpis(
  ds: AdminDataset,
  period: PeriodPair = getPeriodPair(),
): Kpis {
  const subByUser = subscriptionByUser(ds);
  const subs = [...subByUser.values()];

  const totalActive = subs.filter((s) => s.status === "active").length;
  const totalTrialing = subs.filter((s) => s.status === "trialing").length;

  const mrr = computeMrr(
    subs.filter((s) => s.status === "active").map((s) => ({ tier: s.tier, cadence: s.cadence })),
  );

  // New signups (accounts created in window).
  const newSignups = kpi(
    ds.profiles.filter((p) => inRange(p.created_at, period.current)).length,
    ds.profiles.filter((p) => inRange(p.created_at, period.prior)).length,
  );

  // Lifetime trial→paid conversion (snapshot approximation): of every sub that
  // ever started a trial, the fraction currently active.
  const everTrialed = subs.filter((s) => s.trial_started_at != null);
  const converted = everTrialed.filter((s) => s.status === "active").length;
  const trialConversionPct =
    everTrialed.length > 0
      ? Math.round((converted / everTrialed.length) * 1000) / 10
      : null;

  // Churn: subs moved to cancelled/expired in the window (by updated_at).
  const churnIn = (range: typeof period.current) =>
    subs.filter(
      (s) =>
        (s.status === "cancelled" || s.status === "expired") &&
        inRange(s.updated_at, range),
    ).length;
  const churn = kpi(churnIn(period.current), churnIn(period.prior));
  const churnRatePct =
    totalActive + churn.value > 0
      ? Math.round((churn.value / (totalActive + churn.value)) * 1000) / 10
      : null;

  // Plans generated in window.
  const plansGenerated = kpi(
    ds.plans.filter((p) => inRange(p.created_at, period.current)).length,
    ds.plans.filter((p) => inRange(p.created_at, period.prior)).length,
  );

  // AI spend (USD) in window = plan generations + chat.
  const spendIn = (range: typeof period.current) =>
    ds.generations
      .filter((g) => inRange(g.created_at, range))
      .reduce((s, g) => s + (g.cost_usd ?? 0), 0) +
    ds.chats
      .filter((c) => inRange(c.created_at, range))
      .reduce((s, c) => s + (c.cost_usd ?? 0), 0);
  const aiCurrent = Math.round(spendIn(period.current) * 100) / 100;
  const aiPrior = Math.round(spendIn(period.prior) * 100) / 100;
  const aiSpendUsd = kpi(aiCurrent, aiPrior);

  // AI as % of revenue: period ≈ a month, so compare to MRR (USD).
  const aiSpendPctOfRevenue =
    mrr.mrrUsd > 0 ? Math.round((aiCurrent / mrr.mrrUsd) * 1000) / 10 : null;

  // Avg beneficiaries per account.
  const membersByUser = groupBy(ds.members, (m) => m.user_id);
  const beneficiariesPerAccount = ds.profiles.map(
    (p) =>
      1 +
      (membersByUser.get(p.id) ?? []).filter((m) => m.role !== "housekeeper").length,
  );
  const avgHousehold =
    beneficiariesPerAccount.length > 0
      ? Math.round(
          (beneficiariesPerAccount.reduce((a, b) => a + b, 0) /
            beneficiariesPerAccount.length) *
            10,
        ) / 10
      : 0;

  return {
    subscriberCount: ds.profiles.length,
    totalActive,
    totalTrialing,
    mrr,
    newSignups,
    trialConversionPct,
    churn,
    churnRatePct,
    plansGenerated,
    aiSpendUsd,
    aiSpendPctOfRevenue,
    avgHousehold,
  };
}

// ---------------------------------------------------------------------------
// Subscriber table: filter / sort / paginate (pure)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 25;

export function filterSortPaginate(
  rows: SubscriberRow[],
  params: SubscriberListParams = {},
): SubscriberListResult {
  const search = params.search?.trim().toLowerCase();
  let filtered = rows;

  if (search) {
    filtered = filtered.filter(
      (r) =>
        r.displayName?.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search),
    );
  }
  if (params.tier) filtered = filtered.filter((r) => r.tier === params.tier);
  if (params.status) filtered = filtered.filter((r) => r.status === params.status);

  const sortKey: SubscriberSortKey = params.sort ?? "signupAt";
  const dir = params.dir ?? "desc";
  const mult = dir === "asc" ? 1 : -1;
  filtered = [...filtered].sort((a, b) => compareRows(a, b, sortKey) * mult);

  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);
  const startIdx = (page - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  return { rows: pageRows, total, page, pageSize, pageCount };
}

function compareRows(
  a: SubscriberRow,
  b: SubscriberRow,
  key: SubscriberSortKey,
): number {
  switch (key) {
    case "displayName":
      return (a.displayName ?? "").localeCompare(b.displayName ?? "", "ar");
    case "status":
      return (a.status ?? "").localeCompare(b.status ?? "");
    case "beneficiaries":
      return a.beneficiaries - b.beneficiaries;
    case "plansGenerated":
      return a.plansGenerated - b.plansGenerated;
    case "lifetimeAiCostUsd":
      return a.lifetimeAiCostUsd - b.lifetimeAiCostUsd;
    case "lastActivityAt":
      return cmpIsoNullsLast(a.lastActivityAt, b.lastActivityAt);
    case "signupAt":
    default:
      return cmpIso(a.signupAt, b.signupAt);
  }
}

function cmpIso(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function cmpIsoNullsLast(a: string | null, b: string | null): number {
  // Keep nulls at the "low" end so desc sort puts most-recent first, nulls last.
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return cmpIso(a, b);
}
