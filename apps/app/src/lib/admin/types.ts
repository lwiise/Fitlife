/**
 * Shared, server-agnostic types for the admin dashboard. Kept free of
 * `server-only` imports so client components can import the shapes as types.
 */

import type { MrrBreakdown } from "./revenue";
import type { Trend } from "./period";

export type { MrrBreakdown, Trend };

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

export interface Kpi {
  value: number;
  prior: number;
  trend: Trend;
}

export interface Kpis {
  /** Total accounts in the system (for empty-state detection). */
  subscriberCount: number;
  totalActive: number;
  totalTrialing: number;
  mrr: MrrBreakdown;
  newSignups: Kpi;
  /** Lifetime trial→paid conversion (snapshot approximation). */
  trialConversionPct: number | null;
  churn: Kpi;
  churnRatePct: number | null;
  plansGenerated: Kpi;
  /** AI spend in USD this period (plan generations + chat). */
  aiSpendUsd: Kpi;
  /** AI spend as % of monthly revenue (margin signal). */
  aiSpendPctOfRevenue: number | null;
  /** Avg beneficiaries per account. */
  avgHousehold: number;
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
