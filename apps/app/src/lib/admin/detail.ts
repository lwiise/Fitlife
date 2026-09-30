import "server-only";

import { adminDb } from "@/lib/admin/db";

/**
 * Single-subscriber loaders and shared shapes (service-role, server-only).
 *
 * The family page itself loads through the sectional loaders in
 * lib/admin/family.ts, which deliberately OMIT sensitive health values
 * (allergies, dislikes, medical conditions, pregnancy/lactation) and show a
 * derived medical-gate BOOLEAN only. Those values load only through
 * `loadSubscriberHealth`, which the gated, audit-logged /health sub-route
 * calls — data minimization per the spec. `loadPlanForInspect` feeds the
 * audited meal-plan view. The subscription columns and mapper are shared
 * with family.ts.
 */

// ── Shapes ─────────────────────────────────────────────────────────────────

export interface SubscriptionRow {
  tier: string | null;
  status: string | null;
  cadence: string | null;
  createdAt: string;
  updatedAt: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  lemonsqueezySubscriptionId: string | null;
  lemonsqueezyCustomerId: string | null;
  lemonsqueezyVariantId: string | null;
}

export interface MemberSummary {
  /** "mom" (owner) or family_members.id. */
  id: string;
  name: string;
  role: string;
  memberType: string;
  isHousekeeper: boolean;
  pickyEater: boolean | null;
  /** Goal from the latest plan if present, else the stored profile/member goal. */
  primaryGoal: string | null;
  caloriesTarget: number | null;
  macros: { protein_g: number; carbs_g: number; fat_g: number } | null;
  /** Derived ops flag — this member trips the medical gate (no detail shown). */
  medicalGate: boolean;
  consultedDoctor: boolean | null;
}

export interface PlanSummary {
  id: string;
  status: string;
  createdAt: string;
  generatedAt: string | null;
  daysCovered: number;
  memberCount: number;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiModel: string | null;
  costUsd: number | null;
}

export interface GenerationSummary {
  id: string;
  status: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  mealPlanId: string | null;
}

export interface SubscriberDetail {
  userId: string;
  email: string | null;
  /** GoTrue ban active (banned_until in the future) → blocked from logging in. */
  deactivated: boolean;
  account: {
    displayName: string | null;
    preferredLanguage: string;
    signupAt: string;
    onboardingCompletedAt: string | null;
    familyWideCompletedAt: string | null;
    momProfileCompletedAt: string | null;
  };
  subscription: SubscriptionRow | null;
  subscriptionHistory: SubscriptionRow[];
  members: MemberSummary[];
  plans: PlanSummary[];
  generations: GenerationSummary[];
  engagement: { chatCount: number; lastChatAt: string | null; chatCostUsd: number };
  flags: {
    medicalGateBlocked: boolean;
    overLimit: boolean;
    failedGenerations: number;
    beneficiaries: number;
  };
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/** The subscriptions columns `mapSubscription` reads (shared with family.ts). */
export const SUBSCRIPTION_COLUMNS =
  "tier, status, cadence, created_at, updated_at, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end, cancelled_at, lemonsqueezy_subscription_id, lemonsqueezy_customer_id, lemonsqueezy_variant_id";

export function mapSubscription(s: {
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
  lemonsqueezy_customer_id: string | null;
  lemonsqueezy_variant_id: string | null;
}): SubscriptionRow {
  return {
    tier: s.tier,
    status: s.status,
    cadence: s.cadence,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    trialStartedAt: s.trial_started_at,
    trialEndsAt: s.trial_ends_at,
    currentPeriodEnd: s.current_period_end,
    cancelAtPeriodEnd: s.cancel_at_period_end,
    cancelledAt: s.cancelled_at,
    lemonsqueezySubscriptionId: s.lemonsqueezy_subscription_id,
    lemonsqueezyCustomerId: s.lemonsqueezy_customer_id,
    lemonsqueezyVariantId: s.lemonsqueezy_variant_id,
  };
}

// ── Sensitive health detail (gated + audit-logged caller) ────────────────────

export interface MemberHealth {
  id: string;
  name: string;
  role: string;
  isPregnant: boolean | null;
  trimester: number | null;
  monthsPostpartum: number | null;
  highRiskPregnancy: boolean | null;
  consultedDoctor: boolean | null;
  medicalConditions: string[];
  allergies: unknown;
  dislikes: unknown;
}

export interface SubscriberHealth {
  userId: string;
  displayName: string | null;
  members: MemberHealth[];
}

export async function loadSubscriberHealth(
  userId: string,
): Promise<SubscriberHealth | null> {
  const db = adminDb();

  const { data: profile } = await db
    .from("profiles")
    .select(
      "id, display_name, is_pregnant, pregnancy_trimester, months_postpartum, high_risk_pregnancy, consulted_doctor, medical_conditions, allergies, dislikes",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: members } = await db
    .from("family_members")
    .select(
      "id, name, role, trimester, months_postpartum, high_risk_pregnancy, consulted_doctor, medical_conditions, allergies, dislikes",
    )
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  const mom: MemberHealth = {
    id: "mom",
    name: profile.display_name ?? "—",
    role: "mom",
    isPregnant: profile.is_pregnant ?? null,
    trimester: profile.pregnancy_trimester ?? null,
    monthsPostpartum: profile.months_postpartum ?? null,
    highRiskPregnancy: profile.high_risk_pregnancy ?? null,
    consultedDoctor: profile.consulted_doctor ?? null,
    medicalConditions: profile.medical_conditions ?? [],
    allergies: profile.allergies ?? null,
    dislikes: profile.dislikes ?? null,
  };

  const familyHealth: MemberHealth[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    isPregnant: null,
    trimester: m.trimester ?? null,
    monthsPostpartum: m.months_postpartum ?? null,
    highRiskPregnancy: m.high_risk_pregnancy ?? null,
    consultedDoctor: m.consulted_doctor ?? null,
    medicalConditions: m.medical_conditions ?? [],
    allergies: m.allergies ?? null,
    dislikes: m.dislikes ?? null,
  }));

  return {
    userId,
    displayName: profile.display_name,
    members: [mom, ...familyHealth],
  };
}

// ── Raw plan_data inspection (gated + audit-logged caller) ───────────────────

export interface PlanInspect {
  id: string;
  status: string;
  createdAt: string;
  generatedAt: string | null;
  planData: unknown;
}

export async function loadPlanForInspect(
  userId: string,
  planId: string,
): Promise<PlanInspect | null> {
  const db = adminDb();
  const { data } = await db
    .from("meal_plans")
    .select("id, user_id, status, created_at, generated_at, plan_data")
    .eq("id", planId)
    .maybeSingle();

  // Guard: the plan must belong to the subscriber named in the URL.
  if (!data || data.user_id !== userId) return null;

  return {
    id: data.id,
    status: data.status,
    createdAt: data.created_at,
    generatedAt: data.generated_at,
    planData: data.plan_data,
  };
}
