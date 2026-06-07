import "server-only";

import { adminDb } from "@/lib/admin/db";
import { paginate } from "@/lib/admin/queries";

/**
 * Trends + operational-health data. Loaded separately from the overview dataset
 * so each page fetches only what it shows. Includes a few extra fields the
 * overview deliberately omits (generation error/ids for the failure queue;
 * medical-gate booleans for the support signal — booleans only, never the
 * underlying condition lists).
 */

// Matches the consumer chat route's per-user daily cap.
const CHAT_DAILY_CAP = 30;
const DAY_MS = 86_400_000;
const FAILURE_LIST_LIMIT = 50;

interface InsProfile {
  id: string;
  display_name: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  has_medical_conditions: boolean;
  is_pregnant: boolean;
  high_risk_pregnancy: boolean | null;
  consulted_doctor: boolean;
}
interface InsSub {
  user_id: string;
  status: string | null;
  created_at: string;
}
interface InsMember {
  user_id: string;
  role: string;
  high_risk_pregnancy: boolean | null;
  consulted_doctor: boolean | null;
}
interface InsPlan {
  user_id: string;
  status: string;
  created_at: string;
}
interface InsGen {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  cost_usd: number | null;
  error_message: string | null;
  meal_plan_id: string | null;
}
interface InsChat {
  user_id: string;
  created_at: string;
  cost_usd: number | null;
}

export interface InsightsDataset {
  profiles: InsProfile[];
  subscriptions: InsSub[];
  members: InsMember[];
  plans: InsPlan[];
  generations: InsGen[];
  chats: InsChat[];
  truncated: string[];
}

export async function loadInsightsDataset(): Promise<InsightsDataset> {
  const db = adminDb();
  const truncated: string[] = [];
  const onTruncate = (l: string) => {
    if (!truncated.includes(l)) truncated.push(l);
  };

  const [profiles, subscriptions, members, plans, generations, chats] =
    await Promise.all([
      paginate<InsProfile>(
        (f, t) =>
          db
            .from("profiles")
            .select(
              "id, display_name, created_at, onboarding_completed_at, has_medical_conditions, is_pregnant, high_risk_pregnancy, consulted_doctor",
            )
            .range(f, t),
        "profiles",
        onTruncate,
      ),
      paginate<InsSub>(
        (f, t) =>
          db
            .from("subscriptions")
            .select("user_id, status, created_at")
            .order("created_at", { ascending: false })
            .range(f, t),
        "subscriptions",
        onTruncate,
      ),
      paginate<InsMember>(
        (f, t) =>
          db
            .from("family_members")
            .select("user_id, role, high_risk_pregnancy, consulted_doctor")
            .range(f, t),
        "family_members",
        onTruncate,
      ),
      paginate<InsPlan>(
        (f, t) =>
          db.from("meal_plans").select("user_id, status, created_at").range(f, t),
        "meal_plans",
        onTruncate,
      ),
      paginate<InsGen>(
        (f, t) =>
          db
            .from("plan_generations")
            .select("id, user_id, status, created_at, cost_usd, error_message, meal_plan_id")
            .order("created_at", { ascending: false })
            .range(f, t),
        "plan_generations",
        onTruncate,
      ),
      paginate<InsChat>(
        (f, t) =>
          db.from("chat_messages").select("user_id, created_at, cost_usd").range(f, t),
        "chat_messages",
        onTruncate,
      ),
    ]);

  return { profiles, subscriptions, members, plans, generations, chats, truncated };
}

// ── Trends ───────────────────────────────────────────────────────────────────

export interface MonthPoint {
  monthStart: string;
  value: number;
}
export interface MonthSplit {
  monthStart: string;
  completed: number;
  failed: number;
}
export interface FunnelData {
  signups: number;
  onboarded: number;
  firstPlan: number;
  trialing: number;
  active: number;
}
export interface InsightsTrends {
  newSignups: MonthPoint[];
  cumulativeSubscribers: MonthPoint[];
  aiCost: MonthPoint[];
  generations: MonthSplit[];
  funnel: FunnelData;
  costPerPlanUsd: number | null;
  costPerActiveUserUsd: number | null;
  totalAiCostUsd: number;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(
  n: number,
  now: Date,
): Array<{ key: string; monthStart: string }> {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: Array<{ key: string; monthStart: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push({ key: monthKey(d), monthStart: d.toISOString() });
  }
  return out;
}

function mostRecentSubByUser(ds: InsightsDataset): Map<string, InsSub> {
  const map = new Map<string, InsSub>();
  for (const s of ds.subscriptions) if (!map.has(s.user_id)) map.set(s.user_id, s);
  return map;
}

export function computeTrends(
  ds: InsightsDataset,
  months = 6,
  now: Date = new Date(),
): InsightsTrends {
  const monthsN = Math.max(1, months);
  const buckets = lastMonths(monthsN, now);
  // Oldest bucket's first day — derived directly so we don't index buckets[0].
  const windowStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - (monthsN - 1),
    1,
  );

  const countByMonth = (items: Array<{ created_at: string }>) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = monthKey(new Date(it.created_at));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const signupMap = countByMonth(ds.profiles);
  const newSignups: MonthPoint[] = buckets.map((b) => ({
    monthStart: b.monthStart,
    value: signupMap.get(b.key) ?? 0,
  }));

  // Cumulative = profiles created before the window + running sum within it.
  const baseline = ds.profiles.filter(
    (p) => new Date(p.created_at).getTime() < windowStart,
  ).length;
  let running = baseline;
  const cumulativeSubscribers: MonthPoint[] = newSignups.map((pt) => {
    running += pt.value;
    return { monthStart: pt.monthStart, value: running };
  });

  // AI cost per month = generations + chat.
  const costMap = new Map<string, number>();
  for (const g of ds.generations) {
    const k = monthKey(new Date(g.created_at));
    costMap.set(k, (costMap.get(k) ?? 0) + (g.cost_usd ?? 0));
  }
  for (const c of ds.chats) {
    const k = monthKey(new Date(c.created_at));
    costMap.set(k, (costMap.get(k) ?? 0) + (c.cost_usd ?? 0));
  }
  const aiCost: MonthPoint[] = buckets.map((b) => ({
    monthStart: b.monthStart,
    value: Math.round((costMap.get(b.key) ?? 0) * 100) / 100,
  }));

  // Generations completed/failed per month.
  const genMap = new Map<string, { completed: number; failed: number }>();
  for (const g of ds.generations) {
    const k = monthKey(new Date(g.created_at));
    const cur = genMap.get(k) ?? { completed: 0, failed: 0 };
    if (g.status === "completed") cur.completed += 1;
    else if (g.status === "failed") cur.failed += 1;
    genMap.set(k, cur);
  }
  const generations: MonthSplit[] = buckets.map((b) => ({
    monthStart: b.monthStart,
    completed: genMap.get(b.key)?.completed ?? 0,
    failed: genMap.get(b.key)?.failed ?? 0,
  }));

  // Funnel.
  const subByUser = mostRecentSubByUser(ds);
  const subs = [...subByUser.values()];
  const usersWithPlan = new Set(ds.plans.map((p) => p.user_id));
  const funnel: FunnelData = {
    signups: ds.profiles.length,
    onboarded: ds.profiles.filter((p) => p.onboarding_completed_at != null).length,
    firstPlan: usersWithPlan.size,
    trialing: subs.filter((s) => s.status === "trialing").length,
    active: subs.filter((s) => s.status === "active").length,
  };

  // Scalars.
  const totalAiCostUsd =
    Math.round(
      (ds.generations.reduce((s, g) => s + (g.cost_usd ?? 0), 0) +
        ds.chats.reduce((s, c) => s + (c.cost_usd ?? 0), 0)) *
        100,
    ) / 100;
  const planCount = ds.plans.length;
  const costPerPlanUsd =
    planCount > 0 ? Math.round((totalAiCostUsd / planCount) * 10000) / 10000 : null;
  const costPerActiveUserUsd =
    funnel.active > 0
      ? Math.round((totalAiCostUsd / funnel.active) * 10000) / 10000
      : null;

  return {
    newSignups,
    cumulativeSubscribers,
    aiCost,
    generations,
    funnel,
    costPerPlanUsd,
    costPerActiveUserUsd,
    totalAiCostUsd,
  };
}

// ── Operational health ───────────────────────────────────────────────────────

export interface OpsFailure {
  userId: string;
  name: string;
  createdAt: string;
  error: string | null;
  mealPlanId: string | null;
}
export interface OpsUser {
  userId: string;
  name: string;
}
export interface OpsBilling {
  userId: string;
  name: string;
  status: string;
}
export interface InsightsOps {
  failures: OpsFailure[];
  failureTotal: number;
  medicalGate: OpsUser[];
  chatCapToday: number;
  billing: OpsBilling[];
}

export function computeOps(
  ds: InsightsDataset,
  now: Date = new Date(),
): InsightsOps {
  const nameByUser = new Map<string, string>();
  for (const p of ds.profiles) nameByUser.set(p.id, p.display_name ?? "—");
  const nameOf = (id: string) => nameByUser.get(id) ?? "—";

  // Failed generations queue.
  const failed = ds.generations.filter((g) => g.status === "failed");
  const failures: OpsFailure[] = failed.slice(0, FAILURE_LIST_LIMIT).map((g) => ({
    userId: g.user_id,
    name: nameOf(g.user_id),
    createdAt: g.created_at,
    error: g.error_message,
    mealPlanId: g.meal_plan_id,
  }));

  // Medical-gate blocks (booleans only — support signal, not health detail).
  const membersByUser = new Map<string, InsMember[]>();
  for (const m of ds.members) {
    const arr = membersByUser.get(m.user_id);
    if (arr) arr.push(m);
    else membersByUser.set(m.user_id, [m]);
  }
  const medicalGate: OpsUser[] = [];
  for (const p of ds.profiles) {
    const momGate =
      (p.has_medical_conditions || p.is_pregnant || p.high_risk_pregnancy === true) &&
      p.consulted_doctor !== true;
    const memberGate = (membersByUser.get(p.id) ?? []).some(
      (m) => m.high_risk_pregnancy === true && m.consulted_doctor !== true,
    );
    if (momGate || memberGate) medicalGate.push({ userId: p.id, name: nameOf(p.id) });
  }

  // Chat-cap pressure today (proxy for rate-limit hits).
  const since = now.getTime() - DAY_MS;
  const chatToday = new Map<string, number>();
  for (const c of ds.chats) {
    if (new Date(c.created_at).getTime() >= since) {
      chatToday.set(c.user_id, (chatToday.get(c.user_id) ?? 0) + 1);
    }
  }
  let chatCapToday = 0;
  for (const count of chatToday.values()) if (count >= CHAT_DAILY_CAP) chatCapToday += 1;

  // Billing anomalies.
  const subByUser = mostRecentSubByUser(ds);
  const billing: OpsBilling[] = [];
  for (const s of subByUser.values()) {
    if (s.status === "past_due" || s.status === "expired") {
      billing.push({ userId: s.user_id, name: nameOf(s.user_id), status: s.status });
    }
  }

  return {
    failures,
    failureTotal: failed.length,
    medicalGate,
    chatCapToday,
    billing,
  };
}
