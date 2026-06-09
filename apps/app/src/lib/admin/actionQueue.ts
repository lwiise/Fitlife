/**
 * Action Queue — turns the dashboard into an operating tool. Pure + testable.
 * Combines the watchlists + systemic failure buckets into one prioritized list.
 * Labels are NOT localized here (kept as data) so the component can render them
 * in the active admin language and this stays unit-testable.
 */

import type { TrialWatchRow, QuietPayingRow } from "@/lib/admin/metrics";

export type ActionKind =
  | "trial_expiring"
  | "past_due"
  | "quiet_high_value"
  | "systemic_failures";

export type ActionSeverity = "high" | "medium" | "low";

export interface ActionItem {
  kind: ActionKind;
  severity: ActionSeverity;
  subscriberId?: string;
  subscriberName?: string | null;
  /** Primary number rendered into the label (days left / count / MRR). */
  metric?: number;
  /** Secondary descriptor (tier / failure cause). */
  detail?: string;
  href: string;
}

const SEVERITY_RANK: Record<ActionSeverity, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<ActionKind, number> = {
  past_due: 0,
  trial_expiring: 1,
  systemic_failures: 2,
  quiet_high_value: 3,
};

const subHref = (id: string) => `/admin/subscribers/${id}`;

export function buildActionQueue(input: {
  trials: TrialWatchRow[];
  pastDue: Array<{ userId: string; name: string | null }>;
  quiet: QuietPayingRow[];
  failureBuckets: Array<{ cause: string; count: number }>;
  thresholds?: { failureBucketMin?: number; trialUrgentDays?: number };
}): ActionItem[] {
  const failureMin = input.thresholds?.failureBucketMin ?? 3;
  const trialUrgent = input.thresholds?.trialUrgentDays ?? 3;
  const items: ActionItem[] = [];

  // Past-due: paying but failing to bill — always high.
  for (const p of input.pastDue) {
    items.push({
      kind: "past_due",
      severity: "high",
      subscriberId: p.userId,
      subscriberName: p.name,
      href: subHref(p.userId),
    });
  }

  // Trials expiring within 7 days (≤3d urgent → high, else medium).
  for (const tr of input.trials) {
    if (tr.daysLeft > 7) continue;
    items.push({
      kind: "trial_expiring",
      severity: tr.daysLeft <= trialUrgent ? "high" : "medium",
      subscriberId: tr.userId,
      subscriberName: tr.name,
      metric: tr.daysLeft,
      detail: tr.tier ?? undefined,
      href: subHref(tr.userId),
    });
  }

  // Systemic generation failures grouped by cause, above threshold.
  for (const b of input.failureBuckets) {
    if (b.count < failureMin) continue;
    items.push({
      kind: "systemic_failures",
      severity: b.count >= failureMin * 2 ? "high" : "medium",
      metric: b.count,
      detail: b.cause,
      href: "/admin/insights#product",
    });
  }

  // Quiet high-value accounts near renewal — medium.
  for (const q of input.quiet) {
    items.push({
      kind: "quiet_high_value",
      severity: "medium",
      subscriberId: q.userId,
      subscriberName: q.name,
      metric: q.mrrSar,
      detail: q.tier ?? undefined,
      href: subHref(q.userId),
    });
  }

  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      (b.metric ?? 0) - (a.metric ?? 0),
  );
}
