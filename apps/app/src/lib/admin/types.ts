/**
 * Shared, server-agnostic types for the admin dashboard. Kept free of
 * `server-only` imports so client components can import the shapes as types.
 */

import type { MrrBreakdown } from "./revenue";
import type { Trend } from "./period";
import type { GrossMargin } from "./margin";
import type {
  Granularity,
  MetricKey,
  MetricView,
  RangePreset,
} from "./timeseries";

export type { MrrBreakdown, Trend, GrossMargin };
export type { Granularity, MetricKey, MetricView, RangePreset };

/** One family's account + billing fields (the base of FamilyRow) — minimized, ops-relevant fields only. */
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
  /**
   * subscriptions.ends_at — LemonSqueezy's paid-through date on a cancelled
   * (or paused) subscription. A portal cancellation often arrives with no new
   * period end and this set; see subscriptionCancelState. Read only on a row
   * that has stopped renewing — on a renewing one it is left over
   * (paidThroughAt).
   */
  endsAt: string | null;
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

/**
 * The Overview's data (buildOverviewView): the shown metrics' series with their
 * comparison window, for the metric tiles and the chart (_overview/MetricBoard),
 * plus the AI-cost figures (_overview/CostTiles) — all scoped to the selected
 * range. Every series is a snapshot reconstruction (see lib/admin/timeseries.ts)
 * → `approximated: true`. The AI-cost figures are exact.
 */
export interface OverviewView {
  /** Total accounts in the system (for empty-state detection + per-account AI). */
  subscriberCount: number;
  /** Active (paid) subscriptions — excludes trialing. */
  totalActive: number;

  // ── Chart selection ──
  selectedMetric: MetricKey;
  /** The (≤4) metric tiles, in display order. */
  shownMetrics: MetricKey[];
  /** Computed views for the shown tiles + the selected metric. */
  metrics: MetricView[];

  // ── Range / interval ──
  preset: RangePreset;
  interval: Granularity;
  comparisonOn: boolean;
  rangeStartIso: string;
  rangeEndIso: string;
  priorStartIso: string;
  priorEndIso: string;
  /** `YYYY-MM-DD` defaults for the custom-range date inputs. */
  fromValue: string;
  toValue: string;
  /** One ISO anchor per current-range bucket (x-axis). */
  bucketIsos: string[];

  // ── AI-cost figures (exact, scoped to the range) ──
  aiCostUsd: number;
  aiCostPerAccountUsd: number | null;
  aiCostPerMemberUsd: number | null;
  /** Range generation cost ÷ plans generated in the range (per household plan). */
  aiCostPerPlanUsd: number | null;
  /** Range generation cost ÷ member-slices across plans (per individual served). */
  aiCostPerMemberPlanUsd: number | null;
  /** AI cost ÷ range-prorated revenue (est.). */
  aiPctOfRevenue: number | null;
  beneficiaryTotal: number;
  /** Exact AI spend (USD) per current-range bucket — for the cost sparkline. */
  aiCostSeries: number[];
  /** Exact AI spend (USD) in the immediately-preceding equal window. */
  aiCostPriorUsd: number;
  /** AI-cost period-over-period change (pct null when comparison is off). */
  aiCostDelta: Trend;
  /** Distinct users with AI activity in the range (engagement, not paying). */
  activeUsersInRange: number;

  /** Series are reconstructed from the snapshot (labeled in the UI). */
  approximated: true;
}
