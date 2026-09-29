/**
 * The admin console's data contract (Concept A · Console, 09/2026).
 *
 * Server-agnostic on purpose: client components import these shapes, the
 * server-only loaders produce them, and the JSON route that feeds the side
 * panel serialises them. Everything here must be plain JSON — no Map, no Date,
 * no functions — because it crosses the server → client boundary.
 *
 * Sensitive health values (allergies, dislikes, medical conditions, pregnancy
 * detail) are deliberately absent from every shape in this file. They load
 * only on the audited /health page (data minimisation, PDPL). The list never
 * carries the medical-gate flag at all; the panel and the family page carry it
 * as a single derived boolean.
 */

import type { SubscriptionRow, MemberSummary } from "./detail";
import type { SubscriberRow } from "./types";

// ── Families list ──────────────────────────────────────────────────────────

/** The saved views in the rail. */
export type FamilyView =
  | "all"
  | "attention"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelling"
  | "ended";

export const FAMILY_VIEWS: FamilyView[] = [
  "all",
  "attention",
  "trialing",
  "active",
  "past_due",
  "cancelling",
  "ended",
];

/**
 * Reasons a family is in "Needs attention". The medical gate is NOT one of
 * them: the list is the least-privileged surface, so it never says who has a
 * medical condition. The panel and the family page show it.
 */
export type FamilyFlag =
  /** The newest meal generation failed and no later meal run completed. */
  | "failed_meal_run"
  /** The newest workout generation failed and no later workout run completed. */
  | "failed_workout_run"
  /** More beneficiaries than the tier allows. */
  | "over_limit"
  /** onboarding_completed_at is null. */
  | "onboarding_incomplete"
  /** cancel_at_period_end is set on a live subscription. */
  | "cancel_scheduled"
  /** subscription status is past_due. */
  | "past_due";

export type PlanCellState = "none" | "generating" | "ready" | "failed";

/** The meal-plan column: the plan the household is actually served. */
export interface MealPlanCell {
  state: PlanCellState;
  /** Days of the week that have meals for the first beneficiary; null = unknown. */
  daysReady: number | null;
  /** Target day count (plan_data.days_total, default 7). */
  daysTotal: number;
  /** The newest run failed and an older plan with content is being served. */
  masked: boolean;
}

/** The exercise-plan column. */
export interface WorkoutPlanCell {
  state: PlanCellState;
  /** The newest run failed and an older program with content is being served. */
  masked: boolean;
}

/** One row of the families table — lean, JSON, sent to the client whole. */
export interface FamilyRow extends SubscriberRow {
  meal: MealPlanCell;
  workout: WorkoutPlanCell;
  /** Ordered most severe first. */
  flags: FamilyFlag[];
}

export type FamilySortKey =
  | "displayName"
  | "status"
  | "beneficiaries"
  | "lastActivityAt"
  | "lifetimeAiCostUsd"
  | "signupAt"
  | "plansGenerated";

/** Toggleable table columns (the family column is always shown). */
export type FamilyColumn =
  | "tier"
  | "status"
  | "meal"
  | "workout"
  | "household"
  | "lastActivity"
  | "cost"
  | "renewal"
  | "signup"
  | "plans";

export const FAMILY_COLUMNS: FamilyColumn[] = [
  "tier",
  "status",
  "meal",
  "workout",
  "household",
  "lastActivity",
  "cost",
  "renewal",
  "signup",
  "plans",
];

export interface FamilyListQuery {
  view: FamilyView;
  q: string;
  tier: string;
  status: string;
  sort: FamilySortKey;
  dir: "asc" | "desc";
  page: number;
}

/** What the console frame needs: rail counts + the ⌘K search index. */
export interface ConsoleNavData {
  counts: Record<FamilyView, number>;
  /** Every family, for the command palette. */
  searchIndex: Array<{ id: string; name: string | null; email: string | null }>;
  /** ISO time the underlying dataset was loaded (the rail footer shows it). */
  loadedAt: string;
  /** Tables where the row ceiling was hit — counts may undercount. */
  truncated: string[];
}

// ── One family ─────────────────────────────────────────────────────────────

/** Tabs of the full family page. The side panel shows the first five. */
export type FamilyTab =
  | "summary"
  | "meal"
  | "exercise"
  | "household"
  | "billing"
  | "runs"
  | "account";

export const FAMILY_TABS: FamilyTab[] = [
  "summary",
  "meal",
  "exercise",
  "household",
  "billing",
  "runs",
  "account",
];

export const PANEL_TABS: FamilyTab[] = [
  "summary",
  "meal",
  "exercise",
  "household",
  "billing",
];

export type AttentionSeverity = "high" | "medium" | "low";

/** A flag explained in a sentence, with the tab that resolves it. */
export interface AttentionReason {
  flag: FamilyFlag | "medical_gate";
  severity: AttentionSeverity;
  /** ISO date the reason refers to (run date, due date…), when there is one. */
  at: string | null;
  tab: FamilyTab;
  /** over_limit: the counts that make the sentence. */
  people?: number;
  maxPeople?: number | null;
}

export interface FamilyHeaderData {
  userId: string;
  displayName: string | null;
  email: string | null;
  deactivated: boolean;
  preferredLanguage: string;
  signupAt: string;
  onboardingCompletedAt: string | null;
  familyWideCompletedAt: string | null;
  momProfileCompletedAt: string | null;
  subscription: SubscriptionRow | null;
  subscriptionHistory: SubscriptionRow[];
  beneficiaries: number;
  hasHousekeeper: boolean;
  tierMaxPeople: number | null;
  overLimit: boolean;
  /** List flags for this family (same rules as FamilyRow.flags). */
  flags: FamilyFlag[];
  /** Any member trips the doctor sign-off gate (boolean only — no detail). */
  medicalGateBlocked: boolean;
  reasons: AttentionReason[];
  lifetimeAiCostUsd: number;
  lastActivityAt: string | null;
  engagement: { chatCount: number; lastChatAt: string | null; chatCostUsd: number };
}

// ── Meal plan ──────────────────────────────────────────────────────────────

export interface MealPlanListItem {
  id: string;
  /** Raw meal_plans.status. */
  status: string;
  createdAt: string;
  generatedAt: string | null;
  /** Days that exist for the first beneficiary; null = unknown. */
  daysReady: number | null;
  daysTotal: number;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiModel: string | null;
  /** Sum of this plan's generation runs. */
  costUsd: number | null;
}

export interface MealWeekMeal {
  /** Engine slot key (breakfast, lunch, dinner, snack…). */
  slot: string;
  /** Arabic dish name as generated. */
  name: string;
  calories: number | null;
  proteinG: number | null;
  /** How many beneficiaries share this dish (1 = own dish). */
  sharedBy: number;
}

export interface MealWeekDay {
  dayIndex: number;
  meals: MealWeekMeal[];
  totalCalories: number | null;
  totalProteinG: number | null;
}

export interface MealWeekMember {
  memberId: string;
  name: string;
  isChild: boolean;
  caloriesTarget: number | null;
  proteinTargetG: number | null;
  days: MealWeekDay[];
}

/** A compact, display-only projection of plan_data — never the raw blob. */
export interface MealWeekProjection {
  weekStartDate: string | null;
  daysTotal: number;
  generating: boolean;
  members: MealWeekMember[];
  /** Day indices (0-6) that exist for every member. */
  completeDays: number[];
}

export interface MealSection {
  /** The plan the household is served (getLatestPlan's rule); null = none. */
  served: {
    plan: MealPlanListItem;
    week: MealWeekProjection | null;
    /** The newest run failed and this older plan is shown instead. */
    masked: boolean;
    maskedFailureAt: string | null;
  } | null;
  /** Every meal plan, newest first. */
  plans: MealPlanListItem[];
}

// ── Exercise plan ──────────────────────────────────────────────────────────

export interface WorkoutPlanListItem {
  id: string;
  /** Raw workout_plans.status. */
  status: string;
  createdAt: string;
  generatedAt: string | null;
  updatedAt: string;
  errorMessage: string | null;
  traineeCount: number | null;
  sessionsPerWeek: number | null;
  aiModel: string | null;
  costUsd: number | null;
}

export interface TraineeProfileSummary {
  location: "home" | "gym" | "both" | null;
  equipment: string[];
  injuries: string[];
  desiredDays: number | null;
  /** 0 = Sunday … 6 = Saturday. */
  preferredDays: number[] | null;
  focusAreas: string[];
  experience: "beginner" | "intermediate" | "advanced" | null;
  sessionMinutes: string | null;
}

export type SessionMarkStatus = "done" | "moved" | "skipped";

export interface WorkoutSessionMark {
  status: SessionMarkStatus;
  intensity: "easy" | "right" | "hard" | null;
  localDate: string | null;
}

export interface WorkoutExerciseView {
  name: string;
  targetMuscles: string | null;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rir: string | null;
  homeVariant: string | null;
}

export interface WorkoutSessionView {
  /** Weekday-anchored: 0 = Sunday … 6 = Saturday. */
  dayIndex: number;
  name: string;
  durationMin: number | null;
  warmup: string | null;
  cooldown: string | null;
  exercises: WorkoutExerciseView[];
  /** This week's mark, if any. */
  mark: WorkoutSessionMark | null;
}

export interface WorkoutTraineeView {
  memberId: string;
  name: string;
  role: string;
  sex: "male" | "female" | null;
  splitName: string | null;
  progressionNotes: string | null;
  profile: TraineeProfileSummary | null;
  sessions: WorkoutSessionView[];
  doneThisWeek: number;
}

export interface WorkoutIneligibleMember {
  memberId: string;
  name: string;
  reason: "child" | "housekeeper";
  age: number | null;
}

export interface WorkoutSection {
  /** Anyone in the household answered the workout questions. */
  optedIn: boolean;
  /** The program the household is served; null = none yet. */
  served: {
    plan: WorkoutPlanListItem;
    trainees: WorkoutTraineeView[];
    masked: boolean;
  } | null;
  /** The newest row, whatever its state (generating / failed / ready). */
  latest: WorkoutPlanListItem | null;
  /** A workout run is holding until the meal run finishes (meals-first). */
  waitingForMeals: boolean;
  /** Every program, newest first. */
  plans: WorkoutPlanListItem[];
  /** Members who never get a program, and why. */
  ineligible: WorkoutIneligibleMember[];
  /** Riyadh-date window the session marks were read from. */
  marksWindow: { start: string; end: string } | null;
}

// ── Runs, household, the panel ─────────────────────────────────────────────

export type RunKind = "meal" | "workout";

export interface RunRow {
  id: string;
  kind: RunKind;
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
  workoutPlanId: string | null;
}

/** A household member as the admin sees them: MemberSummary plus age. */
export interface HouseholdMember extends MemberSummary {
  age: number | null;
}

/** Everything the side panel shows, in one JSON response. */
export interface FamilyPanelData {
  header: FamilyHeaderData;
  meal: MealSection;
  workout: WorkoutSection;
  household: HouseholdMember[];
}
