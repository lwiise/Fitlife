/**
 * Shared, server-agnostic types for the admin dashboard. Kept free of
 * `server-only` imports so client components can import the shapes as types.
 */

import type { MrrBreakdown } from "./revenue";
import type { Trend } from "./period";
import type { GrossMargin } from "./margin";

export type { MrrBreakdown, Trend, GrossMargin };

/** One row in the subscriber table — minimized, ops-relevant fields only. */
export interface SubscriberRow {
  userId: string;
  displayName: string | null;
  email: string | null;
  tier: string | null;
  status: string | null;
  cadence: string | null;
  /** profiles.created_at — account signup. */
  signupAt: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Beneficiaries counting toward the tier limit: owner + non-housekeeper members. */
  beneficiaries: number;
  hasHousekeeper: boolean;
  /** beneficiaries exceed the tier's max_people (null max = unlimited). */
  overLimit: boolean;
  plansGenerated: number;
  failedPlans: number;
  lastActivityAt: string | null;
  lifetimeAiCostUsd: number;
  onboardingComplete: boolean;
}

export type OverviewMetric = "revenue" | "subs";
export type RangePreset = "week" | "month" | "custom";
export type Granularity = "day" | "week" | "month";

/**
 * The Overview top section: a Revenue/Subscriptions time-series stacked by tier
 * plus an AI-cost strip, all scoped to the selected range. The time-series is a
 * snapshot reconstruction (see lib/admin/timeseries.ts) → `approximated: true`.
 */
export interface OverviewView {
  /** Total accounts in the system (for empty-state detection + per-account AI). */
  subscriberCount: number;
  /** Active (paid) subscriptions — excludes trialing. */
  totalActive: number;

  metric: OverviewMetric;
  preset: RangePreset;
  granularity: Granularity;
  rangeStartIso: string;
  rangeEndIso: string;
  /** `YYYY-MM-DD` defaults for the custom-range date inputs. */
  fromValue: string;
  toValue: string;

  // ── Chart series (one value per bucket) ──
  bucketIsos: string[];
  /** Tiers present, canonical order; keys into the two maps + colour map. */
  tiers: string[];
  revenueByTier: Record<string, number[]>;
  countByTier: Record<string, number[]>;

  // ── AI-cost strip (exact, scoped to the range) ──
  aiCostUsd: number;
  aiCostPerAccountUsd: number | null;
  aiCostPerMemberUsd: number | null;
  /** AI cost ÷ range-prorated revenue (est.). */
  aiPctOfRevenue: number | null;
  beneficiaryTotal: number;

  /** The time-series is reconstructed from the snapshot (labeled in the UI). */
  approximated: true;
}

export interface SubscriberListParams {
  search?: string;
  tier?: string;
  status?: string;
  sort?: SubscriberSortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export type SubscriberSortKey =
  | "signupAt"
  | "lastActivityAt"
  | "lifetimeAiCostUsd"
  | "plansGenerated"
  | "beneficiaries"
  | "displayName"
  | "status";

export interface SubscriberListResult {
  rows: SubscriberRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
