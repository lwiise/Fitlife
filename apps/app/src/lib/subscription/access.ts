import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canGeneratePlan, countMemberRegensThisWeek } from "@/lib/supabase/queries";
import {
  getCurrentSubscription,
  getTierLimit,
  isSubscriptionActive,
} from "./state";
import { isFreeAccessMode } from "./freeAccess";

export type AccessReason =
  | "trial_expired"
  | "subscription_inactive"
  | "past_due"
  | "rate_limit"
  | "person_count_exceeded"
  // The household size could not be read (DB error). Distinct from
  // person_count_exceeded: nothing is known to be wrong, we simply cannot
  // verify the limit, so the honest answer is "try again" — not a silent grant.
  | "count_unavailable";

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
 *
 * Returns null when the count could not be read. It used to return 1 on error,
 * commented "assume worst case (no family members beyond Mom)" — but for a
 * LIMIT check 1 is the BEST case, not the worst: `1 > maxPeople` is false for
 * every tier, so any transient query error silently removed the tier limit
 * entirely and generated plans for an uncapped household. Callers now fail
 * closed with a retryable reason.
 */
export async function countBeneficiaries(userId: string): Promise<number | null> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("role", "housekeeper");

  if (error) {
    console.error("[countBeneficiaries] error:", error);
    return null;
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
  // TEMPORARY testing mode — see lib/subscription/freeAccess.ts.
  // Checked BEFORE the row is fetched, not just inside isSubscriptionActive():
  // an account with no subscriptions row at all (trigger never ran, row deleted
  // mid-test) would otherwise still be refused here, which is exactly the sort
  // of dead end this mode exists to remove.
  if (isFreeAccessMode()) return { allowed: true };

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
    if (currentPeople === null) {
      // Fail CLOSED: we cannot verify the limit, so we do not grant past it.
      return { allowed: false, reason: "count_unavailable" };
    }
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

  // TEMPORARY testing mode: the weekly 3-plan pool would stop a testing session
  // after three generations. NOTE this also removes a spend guard — every
  // generation is a paid Anthropic call.
  if (isFreeAccessMode()) return { allowed: true };

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

  // TEMPORARY testing mode: same reasoning as the account-wide pool above —
  // 3 regenerations per member per week is too few to iterate on one member.
  if (isFreeAccessMode()) return { allowed: true };

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
  // TEMPORARY testing mode: unlocks ACCESS to the advisor. The route's own
  // 30-messages-per-day cap is deliberately left in place — that is abuse and
  // cost protection, not a paywall.
  if (isFreeAccessMode()) return { allowed: true };

  const sub = await getCurrentSubscription(userId);
  if (!sub) return { allowed: false, reason: "subscription_inactive" };
  if (!isSubscriptionActive(sub)) {
    if (sub.status === "past_due") return { allowed: false, reason: "past_due" };
    if (sub.status === "trialing") return { allowed: false, reason: "trial_expired" };
    return { allowed: false, reason: "subscription_inactive" };
  }
  return { allowed: true };
}
