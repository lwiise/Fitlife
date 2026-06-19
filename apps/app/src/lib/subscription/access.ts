import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canGeneratePlan, countMemberRegensThisWeek } from "@/lib/supabase/queries";
import {
  getCurrentSubscription,
  getTierLimit,
  isSubscriptionActive,
} from "./state";

export type AccessReason =
  | "trial_expired"
  | "subscription_inactive"
  | "past_due"
  | "rate_limit"
  | "person_count_exceeded";

export interface AccessDetails {
  current_people?: number;
  max_people?: number | null;
  days_until_reset?: number;
  // True when a rate_limit denial is the PER-MEMBER regenerate quota (3/week per
  // member), not the account-wide new-plan pool — lets the UI show a member-specific
  // message.
  member_regen?: boolean;
}

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: AccessReason; details?: AccessDetails };

/**
 * Counts beneficiaries: Mom (always 1) + non-housekeeper family members.
 */
async function countBeneficiaries(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("role", "housekeeper");

  if (error) {
    console.error("[countBeneficiaries] error:", error);
    // Defensive: assume worst case (no family members beyond Mom)
    return 1;
  }
  return (count ?? 0) + 1;
}

/**
 * Decides whether the authenticated user is allowed to trigger a new plan
 * generation. Checks happen in this order:
 *   1. Subscription exists + is active (trialing-with-valid-end-date or active)
 *   2. Person count is within tier limit
 *   3. Weekly 3-plan rate limit hasn't been exceeded
 */
/**
 * Subscription-active + person-count checks shared by both entry points.
 * Does NOT include the weekly rate limit.
 */
async function checkSubscriptionAndPersonCount(
  userId: string,
): Promise<AccessResult> {
  const sub = await getCurrentSubscription(userId);
  if (!sub) {
    return { allowed: false, reason: "subscription_inactive" };
  }

  if (!isSubscriptionActive(sub)) {
    // Distinguish reasons so the UI can surface the right message:
    //   - past_due  → "payment failed, update card"
    //   - trialing  → "trial expired, subscribe"
    //   - other     → "subscription inactive, subscribe"
    if (sub.status === "past_due") {
      return { allowed: false, reason: "past_due" };
    }
    if (sub.status === "trialing") {
      return { allowed: false, reason: "trial_expired" };
    }
    return { allowed: false, reason: "subscription_inactive" };
  }

  const maxPeople = getTierLimit(sub.tier);
  if (maxPeople !== null) {
    const currentPeople = await countBeneficiaries(userId);
    if (currentPeople > maxPeople) {
      return {
        allowed: false,
        reason: "person_count_exceeded",
        details: { current_people: currentPeople, max_people: maxPeople },
      };
    }
  }

  return { allowed: true };
}

export async function canGenerateNewPlan(userId: string): Promise<AccessResult> {
  const base = await checkSubscriptionAndPersonCount(userId);
  if (!base.allowed) return base;

  const canRateLimit = await canGeneratePlan(userId);
  if (!canRateLimit) {
    return {
      allowed: false,
      reason: "rate_limit",
      // Conservative fallback — the rate-limit window is 7 days but the
      // actual days-until-reset depends on the oldest completed generation.
      details: { days_until_reset: 7 },
    };
  }

  return { allowed: true };
}

/**
 * Access check for onboarding-time generation and family add/remove changes:
 * enforces subscription-active + person-count + (downstream) the medical gate,
 * but BYPASSES the weekly 3/week rate limit. Only ever called by trusted server
 * actions — the bypass must never be reachable from client/URL/body input.
 */
export async function canGenerateForFamilyChange(
  userId: string,
): Promise<AccessResult> {
  return checkSubscriptionAndPersonCount(userId);
}

/**
 * Access check for a MANUAL per-member regenerate (the "إنشاء خطة جديدة" button
 * scoped to one member). Each member has its OWN weekly quota of 3 regenerations
 * (rolling 7 days), counted separately from the account's new-plan pool — so
 * refining one member never competes with new plans or other members. Subscription
 * + person-count still apply. Denials reuse the `rate_limit` reason with
 * `details.member_regen` so the route can show a member-specific message.
 */
const MEMBER_REGEN_WEEKLY_LIMIT = 3;
export async function canRegenerateMemberPlan(
  userId: string,
  memberId: string,
): Promise<AccessResult> {
  const base = await checkSubscriptionAndPersonCount(userId);
  if (!base.allowed) return base;

  const used = await countMemberRegensThisWeek(userId, memberId);
  if (used >= MEMBER_REGEN_WEEKLY_LIMIT) {
    return {
      allowed: false,
      reason: "rate_limit",
      details: { days_until_reset: 7, member_regen: true },
    };
  }

  return { allowed: true };
}

/**
 * True when the user is allowed to VIEW their existing plans (vs. generate
 * new ones). Permissive on expired/cancelled subs so users can still see
 * the last plan they paid for — locks them out of generation, not history.
 */
export async function canViewExistingPlans(userId: string): Promise<boolean> {
  const sub = await getCurrentSubscription(userId);
  if (!sub) return false;
  // Trialing (even if expired), active, past_due, cancelled all see history.
  // Only fully purged accounts (no subscription row) cannot view.
  return true;
}

/**
 * Access check for the read-only advisor chat: requires an active subscription
 * or a valid trial — same bar as plan generation. Deliberately does NOT apply
 * the person-count or weekly plan rate-limit (those gate plan GENERATION, not a
 * read-only chat). The chat's own per-user daily message cap is enforced at the
 * route. Returns the same shape as the other gates so the UI can reuse messaging.
 */
export async function hasAdvisorAccess(userId: string): Promise<AccessResult> {
  const sub = await getCurrentSubscription(userId);
  if (!sub) return { allowed: false, reason: "subscription_inactive" };
  if (!isSubscriptionActive(sub)) {
    if (sub.status === "past_due") return { allowed: false, reason: "past_due" };
    if (sub.status === "trialing") return { allowed: false, reason: "trial_expired" };
    return { allowed: false, reason: "subscription_inactive" };
  }
  return { allowed: true };
}
