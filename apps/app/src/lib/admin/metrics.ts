/**
 * Founder-question metrics derived from the current snapshot. Pure + testable
 * (no `server-only`, no DB) — callers pass the dataset slices they already have.
 *
 * HONESTY: there is no subscription event-history table, so NRR, revenue-at-risk
 * and the like are APPROXIMATED from current status + date columns and labeled
 * as such in the UI. The watchlists (trials expiring, quiet-paying), activation,
 * engagement and locale mix are EXACT.
 */

import { monthlyRevenueSar, sarToUsd, type MrrBreakdown } from "@/lib/admin/revenue";
import { inRange, trend, type DateRange, type PeriodPair, type Trend } from "@/lib/admin/period";

const DAY_MS = 86_400_000;

/**
 * Minimal subscription shape both AdminDataset.subscriptions (SubscriptionLite)
 * and InsightsDataset.subscriptions (InsSub) satisfy structurally.
 */
export interface SubLike {
  user_id: string;
  status: string | null;
  tier: string | null;
  cadence: string | null;
  created_at: string;
  updated_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
}

export const isChurnedStatus = (s: string | null): boolean =>
  s === "cancelled" || s === "expired";

/** Best-available churn timestamp from the snapshot. */
export const churnIsoOf = (s: SubLike): string | null =>
  s.cancelled_at ?? (isChurnedStatus(s.status) ? s.updated_at : null);

/** Most-recent subscription per user (robust to input order). */
export function latestSubByUser<T extends { user_id: string; created_at: string }>(
  subs: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const s of subs) {
    const cur = map.get(s.user_id);
    if (!cur || new Date(s.created_at).getTime() > new Date(cur.created_at).getTime()) {
      map.set(s.user_id, s);
    }
  }
  return map;
}

// ── ARPU ──────────────────────────────────────────────────────────────────────

export function computeArpu(
  mrr: MrrBreakdown,
  activeCount: number,
): { arpuSar: number | null; arpuUsd: number | null } {
  if (activeCount <= 0) return { arpuSar: null, arpuUsd: null };
  return {
    arpuSar: Math.round(mrr.mrrSar / activeCount),
    arpuUsd: Math.round((mrr.mrrUsd / activeCount) * 100) / 100,
  };
}

// ── Net Revenue Retention (approximate) ────────────────────────────────────────

function nrrForWindow(currentSubs: SubLike[], range: DateRange): number | null {
  let startMrr = 0;
  let churnedMrr = 0;
  for (const s of currentSubs) {
    const createdBeforeStart = new Date(s.created_at).getTime() < range.start.getTime();
    if (!createdBeforeStart) continue; // only subs that existed at window start
    const mrr = monthlyRevenueSar(s.tier, s.cadence);
    if (s.status === "active") {
      startMrr += mrr; // still paying → was in the starting base
    } else if (isChurnedStatus(s.status) && inRange(churnIsoOf(s), range)) {
      startMrr += mrr;
      churnedMrr += mrr; // was in the base, churned during the window
    }
  }
  if (startMrr <= 0) return null;
  // Expansion/contraction are unknowable (no upgrade/downgrade events) → 0.
  return Math.round(((startMrr - churnedMrr) / startMrr) * 1000) / 10;
}

export function computeNrr(
  currentSubs: SubLike[],
  period: PeriodPair,
): { value: number | null; trend: Trend } {
  const current = nrrForWindow(currentSubs, period.current);
  const prior = nrrForWindow(currentSubs, period.prior);
  return {
    value: current,
    trend: current != null && prior != null ? trend(current, prior) : { pct: null, direction: "flat" },
  };
}

// ── Revenue at risk (expiring trials + past-due) ───────────────────────────────

export function computeRevenueAtRisk(
  currentSubs: SubLike[],
  now: Date = new Date(),
  withinDays = 7,
): {
  trialsMrrSar: number;
  pastDueMrrSar: number;
  totalSar: number;
  totalUsd: number;
  count: number;
} {
  const horizon = now.getTime() + withinDays * DAY_MS;
  let trialsMrrSar = 0;
  let pastDueMrrSar = 0;
  let count = 0;
  for (const s of currentSubs) {
    if (s.status === "trialing" && s.trial_ends_at) {
      const te = new Date(s.trial_ends_at).getTime();
      if (te >= now.getTime() && te <= horizon) {
        trialsMrrSar += monthlyRevenueSar(s.tier, s.cadence);
        count += 1;
      }
    } else if (s.status === "past_due") {
      pastDueMrrSar += monthlyRevenueSar(s.tier, s.cadence);
      count += 1;
    }
  }
  const totalSar = trialsMrrSar + pastDueMrrSar;
  return { trialsMrrSar, pastDueMrrSar, totalSar, totalUsd: sarToUsd(totalSar), count };
}

// ── Trials-expiring watchlist (exact) ──────────────────────────────────────────

export interface TrialWatchRow {
  userId: string;
  name: string | null;
  email: string | null;
  tier: string | null;
  trialEndsAt: string;
  daysLeft: number;
  planGenerated: boolean;
}

export function computeTrialWatchlist(args: {
  currentSubs: SubLike[];
  nameByUser: Map<string, string | null>;
  emailByUser: Map<string, string | null>;
  usersWithPlan: Set<string>;
  now?: Date;
  horizonDays?: number;
}): TrialWatchRow[] {
  const now = args.now ?? new Date();
  const horizon = now.getTime() + (args.horizonDays ?? 14) * DAY_MS;
  const rows: TrialWatchRow[] = [];
  for (const s of args.currentSubs) {
    if (s.status !== "trialing" || !s.trial_ends_at) continue;
    const te = new Date(s.trial_ends_at).getTime();
    if (te < now.getTime() || te > horizon) continue;
    rows.push({
      userId: s.user_id,
      name: args.nameByUser.get(s.user_id) ?? null,
      email: args.emailByUser.get(s.user_id) ?? null,
      tier: s.tier,
      trialEndsAt: s.trial_ends_at,
      daysLeft: Math.max(0, Math.ceil((te - now.getTime()) / DAY_MS)),
      planGenerated: args.usersWithPlan.has(s.user_id),
    });
  }
  return rows.sort(
    (a, b) => new Date(a.trialEndsAt).getTime() - new Date(b.trialEndsAt).getTime(),
  );
}

// ── Activation (exact) ─────────────────────────────────────────────────────────

export function computeActivation(
  profiles: Array<{ id: string; onboarding_completed_at: string | null }>,
  usersWithPlan: Set<string>,
): { rate: number | null; activated: number; total: number } {
  const total = profiles.length;
  const activated = profiles.filter(
    (p) => p.onboarding_completed_at != null && usersWithPlan.has(p.id),
  ).length;
  return {
    rate: total > 0 ? Math.round((activated / total) * 1000) / 10 : null,
    activated,
    total,
  };
}

// ── Revenue by tier ────────────────────────────────────────────────────────────

export interface TierRevenue {
  tier: string;
  mrrSar: number;
  count: number;
  pct: number;
}

/** Current MRR split across tiers (for the donut). Sorted by MRR desc. */
export function computeRevenueByTier(
  activeSubs: Array<{ tier: string | null; cadence: string | null }>,
): TierRevenue[] {
  const byTier = new Map<string, { mrrSar: number; count: number }>();
  for (const s of activeSubs) {
    if (!s.tier) continue;
    const mrr = monthlyRevenueSar(s.tier, s.cadence);
    const cur = byTier.get(s.tier) ?? { mrrSar: 0, count: 0 };
    cur.mrrSar += mrr;
    cur.count += 1;
    byTier.set(s.tier, cur);
  }
  const total = [...byTier.values()].reduce((a, b) => a + b.mrrSar, 0);
  return [...byTier.entries()]
    .map(([tier, v]) => ({
      tier,
      mrrSar: v.mrrSar,
      count: v.count,
      pct: total > 0 ? Math.round((v.mrrSar / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.mrrSar - a.mrrSar);
}

// ── Plan freshness (approximate — no plan_data blob loaded) ─────────────────────

export function computePlanFreshness(
  currentSubs: SubLike[],
  plans: Array<{ user_id: string; status: string; created_at: string; updated_at: string }>,
  now: Date = new Date(),
  freshDays = 7,
): { rate: number | null; freshCount: number; activeHouseholds: number } {
  const activeUsers = new Set(
    currentSubs.filter((s) => s.status === "active" || s.status === "trialing").map((s) => s.user_id),
  );
  const threshold = now.getTime() - freshDays * DAY_MS;
  const freshUsers = new Set<string>();
  for (const p of plans) {
    if (p.status !== "ready" || !activeUsers.has(p.user_id)) continue;
    const recency = Math.max(
      new Date(p.created_at).getTime(),
      new Date(p.updated_at).getTime(),
    );
    if (recency >= threshold) freshUsers.add(p.user_id);
  }
  const activeHouseholds = activeUsers.size;
  return {
    rate: activeHouseholds > 0 ? Math.round((freshUsers.size / activeHouseholds) * 1000) / 10 : null,
    freshCount: freshUsers.size,
    activeHouseholds,
  };
}

// ── Engagement (exact) ──────────────────────────────────────────────────────────

export function lastActivityByUser(
  chats: Array<{ user_id: string; created_at: string }>,
  plans: Array<{ user_id: string; created_at: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  const note = (id: string, iso: string) => {
    const cur = map.get(id);
    if (!cur || new Date(iso).getTime() > new Date(cur).getTime()) map.set(id, iso);
  };
  for (const c of chats) note(c.user_id, c.created_at);
  for (const p of plans) note(p.user_id, p.created_at);
  return map;
}

export function computeEngagement(args: {
  baseUsers: Set<string>;
  lastActivity: Map<string, string>;
  now?: Date;
}): {
  active7Pct: number | null;
  active30Pct: number | null;
  active7: number;
  active30: number;
  base: number;
} {
  const now = (args.now ?? new Date()).getTime();
  let active7 = 0;
  let active30 = 0;
  for (const id of args.baseUsers) {
    const iso = args.lastActivity.get(id);
    if (!iso) continue;
    const age = now - new Date(iso).getTime();
    if (age <= 7 * DAY_MS) active7 += 1;
    if (age <= 30 * DAY_MS) active30 += 1;
  }
  const base = args.baseUsers.size;
  return {
    active7,
    active30,
    base,
    active7Pct: base > 0 ? Math.round((active7 / base) * 1000) / 10 : null,
    active30Pct: base > 0 ? Math.round((active30 / base) * 1000) / 10 : null,
  };
}

// ── Quiet paying-near-renewal watchlist (exact) ────────────────────────────────

export interface QuietPayingRow {
  userId: string;
  name: string | null;
  email: string | null;
  tier: string | null;
  lastActivityAt: string | null;
  renewalAt: string | null;
  mrrSar: number;
}

export function computeQuietPayingWatchlist(args: {
  currentSubs: SubLike[];
  nameByUser: Map<string, string | null>;
  emailByUser: Map<string, string | null>;
  lastActivity: Map<string, string>;
  now?: Date;
  idleDays?: number;
  renewalWithinDays?: number;
}): QuietPayingRow[] {
  const now = (args.now ?? new Date()).getTime();
  const idleCutoff = now - (args.idleDays ?? 14) * DAY_MS;
  const renewalHorizon = now + (args.renewalWithinDays ?? 14) * DAY_MS;
  const rows: QuietPayingRow[] = [];
  for (const s of args.currentSubs) {
    if (s.status !== "active" || !s.current_period_end) continue;
    const renewal = new Date(s.current_period_end).getTime();
    if (renewal < now || renewal > renewalHorizon) continue; // renewal must be soon
    const lastIso = args.lastActivity.get(s.user_id) ?? null;
    const isIdle = !lastIso || new Date(lastIso).getTime() < idleCutoff;
    if (!isIdle) continue;
    rows.push({
      userId: s.user_id,
      name: args.nameByUser.get(s.user_id) ?? null,
      email: args.emailByUser.get(s.user_id) ?? null,
      tier: s.tier,
      lastActivityAt: lastIso,
      renewalAt: s.current_period_end,
      mrrSar: monthlyRevenueSar(s.tier, s.cadence),
    });
  }
  return rows.sort((a, b) => b.mrrSar - a.mrrSar);
}

// ── Locale mix (exact) ──────────────────────────────────────────────────────────

export interface LocaleCount {
  locale: string;
  count: number;
  pct: number;
}

function tally(values: string[]): LocaleCount[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .map(([locale, count]) => ({
      locale,
      count,
      pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeLocaleMix(
  profiles: Array<{ preferred_language: string }>,
  cookMembers: Array<{ preferred_language: string }>,
): { users: LocaleCount[]; cooks: LocaleCount[] } {
  return {
    users: tally(profiles.map((p) => p.preferred_language)),
    cooks: tally(cookMembers.map((m) => m.preferred_language)),
  };
}
