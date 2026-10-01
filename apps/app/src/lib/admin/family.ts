import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRICING_TIERS, type Tier } from "@fitlife/config";
import {
  memberRequiresDoctorSignOff,
  ownerRequiresDoctorSignOff,
  planHasContent,
} from "@fitlife/plan-engine";
import { adminDb } from "@/lib/admin/db";
import {
  SUBSCRIPTION_COLUMNS,
  mapSubscription,
  type MemberSummary,
  type PlanInspect,
} from "@/lib/admin/detail";
import {
  PAGE,
  ROW_CEILING,
  mapWithConcurrency,
  paginate,
  readByIdChunks,
  subscriberRowOf,
} from "@/lib/admin/queries";
import {
  DEFAULT_DAYS_TOTAL,
  MEAL_PROBE_ROW_COLUMNS,
  daysReadyFromProbe,
  daysTotalFromProbe,
  displayMealPlan,
  finiteNumber,
  householdDaysReady,
  mealServedWindow,
  mealStateOf,
  needsPreviousPlan,
  pickServedMealLite,
  pickServedMealPlan,
  planTargetsById,
  probeMayHoldPlan,
  projectMealWeek,
  resolveMealRow,
  withProbe,
  type MealDisplayRoster,
  type MealPlanRowFull,
  type MealProbeRow,
  type MemberPlanTargets,
  type ResolvedStatus,
} from "@/lib/admin/mealProjection";
import {
  WORKOUT_SERVED_WINDOW,
  currentTrainingWeek,
  marksByMemberDay,
  pickServedWorkoutLite,
  projectWorkoutTrainees,
  resolveWorkoutRowLite,
  sexOf,
  toRawWorkoutRows,
  workoutCellFromRows,
  workoutIneligibleMembers,
  workoutPlanStats,
  type WorkoutRosterEntry,
} from "@/lib/admin/workoutProjection";
import {
  attentionReasons,
  familyStateOf,
  generationKind,
  newestGenerationByKind,
  runFailureAt,
  type ServedCellLike,
} from "@/lib/admin/familyFlags";
import { isUuid } from "@/lib/admin/familyList";
import type {
  FamilyHeaderData,
  FamilyPanelData,
  HouseholdMember,
  MealPlanListItem,
  MealSection,
  RunRow,
  WorkoutPlanListItem,
  WorkoutSection,
  WorkoutTraineeView,
} from "@/lib/admin/console-types";
import { STALE_GENERATION_MIN } from "@/lib/plans/generationTiming";
import {
  pickServedWorkoutRow,
  resolveWorkoutRow,
  type ResolvedWorkoutRow,
  type WorkoutPlanRow,
} from "@/lib/plans/workoutPlanRows";
import { riyadhCurrentYear, riyadhTodayISO } from "@/lib/plans/dayMapping";

/**
 * One family, for the side panel and the full family page (service-role,
 * server-only).
 *
 * Sectional on purpose: the page paints its header first and streams each tab
 * in its own <Suspense>, so every loader is independent and `cache()`d by its
 * arguments. The row reads they share (profile, members, plan rows, runs) are
 * cached too, so the header, the meal tab and the household table issue each
 * query once per request however many of them render.
 *
 * Data minimisation (PDPL). The raw health columns (medical conditions, the
 * pregnancy and high-risk flags) are read here only to derive the doctor-gate
 * BOOLEANS and are never returned, and the workout questionnaire's injury
 * answers are dropped when its summary is built (summarizeWorkoutProfile).
 * What does leave this module, knowingly (the full account is at the top of
 * console-types.ts):
 *  - the exact plan goal, which can be health-derived (see buildHousehold);
 *  - `consultedDoctor`, the doctor-consult answer the gate is built on;
 *  - generated plan and program TEXT — dish and session names, the split,
 *    warm-up/cool-down, home variants, progression notes — which the model
 *    writes from the whole profile and may restate pregnancy, postpartum or
 *    injury context in its own words.
 * The full plan_data blob is read for the SERVED plan only (plus, when the
 * newest run failed, the older candidates getLatestPlan would look at — one
 * at a time, stopping at the first it would serve; and, for the household's
 * targets while a new run has none yet, the newest earlier plan) and is
 * projected to a compact display shape before it leaves this module.
 *
 * Plan rows are read in two steps: every row's cheap columns, then the
 * JSON-path probes of the few that need them (the serve window, and the
 * newest rows of the history for their day counts). A probe decompresses the
 * whole blob, so probing every plan a family ever had cost more than reading
 * them.
 *
 * Errors: a failed read of the tables every section is built on (profiles,
 * subscriptions, family_members, meal_plans, plan_generations) THROWS — an
 * error screen is honest, a panel that reads "no plan" because a query failed
 * is not. Reads of optional detail (workout programs, session marks, chat
 * figures, the auth user, plan probes and blobs) degrade with a console.warn.
 */

// ── Row shapes ──────────────────────────────────────────────────────────────

const PROFILE_COLUMNS =
  "id, display_name, preferred_language, created_at, onboarding_completed_at, family_wide_completed_at, mom_profile_completed_at, primary_goal, has_medical_conditions, is_pregnant, consulted_doctor, medical_conditions, birth_year, member_type, sex, workout_profile";

interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_language: string;
  created_at: string;
  onboarding_completed_at: string | null;
  family_wide_completed_at: string | null;
  mom_profile_completed_at: string | null;
  primary_goal: string | null;
  has_medical_conditions: boolean;
  is_pregnant: boolean;
  consulted_doctor: boolean;
  medical_conditions: string[] | null;
  birth_year: number | null;
  member_type: string | null;
  sex: string | null;
  workout_profile: unknown;
}

const MEMBER_COLUMNS =
  "id, name, role, member_type, birth_year, sex, primary_goal, picky_eater, high_risk_pregnancy, consulted_doctor, medical_conditions, workout_profile, display_order";

interface MemberRow {
  id: string;
  name: string;
  role: string;
  member_type: string;
  birth_year: number | null;
  sex: string | null;
  primary_goal: string | null;
  picky_eater: boolean | null;
  high_risk_pregnancy: boolean | null;
  consulted_doctor: boolean | null;
  medical_conditions: string[] | null;
  workout_profile: unknown;
  display_order: number;
}

interface SubscriptionDbRow {
  tier: string | null;
  status: string | null;
  cadence: string | null;
  created_at: string;
  updated_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  lemonsqueezy_customer_id: string | null;
  lemonsqueezy_variant_id: string | null;
}

/** The cheap columns of a meal plan: no plan_data, no JSON paths into it. */
const MEAL_ROW_COLUMNS =
  "id, status, created_at, updated_at, generated_at, error_message, ai_input_tokens, ai_output_tokens, ai_model";

interface MealRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  error_message: string | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_model: string | null;
}

/**
 * How many of the newest meal plans the history shows a day count for. The
 * count comes from the plan's probes, and each row's probes cost about as much
 * as reading its blob, so the rows past these show "—" (unknown) rather than
 * the page decompressing every plan the family ever had.
 */
export const MEAL_HISTORY_PROBED_ROWS = 20;

interface WorkoutRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  error_message: string | null;
  ai_model: string | null;
}

interface GenerationRow {
  id: string;
  status: string;
  plan_kind: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  meal_plan_id: string | null;
  workout_plan_id: string | null;
}

/** The advisor chat, as the header reports it. */
interface ChatStats {
  count: number;
  lastAt: string | null;
  costUsd: number;
}

const NO_CHATS: ChatStats = { count: 0, lastAt: null, costUsd: 0 };

// ── The per-family reader ───────────────────────────────────────────────────

type Build<Row> = (
  from: number,
  to: number,
) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;

const warn = (what: string, detail?: unknown) =>
  console.warn(`[admin-family] ${what}`, detail instanceof Error ? detail.message : (detail ?? ""));

/** Every row of a per-family read; throws on error (core tables). */
function readAll<Row>(label: string, build: Build<Row>): Promise<Row[]> {
  return paginate(build, label, () => warn(`${label}: row ceiling hit`));
}

/** Every row of a per-family read; an error degrades to [] (optional tables). */
async function readAllOptional<Row>(label: string, build: Build<Row>): Promise<Row[]> {
  try {
    return await readAll(label, build);
  } catch (err) {
    warn(`${label} read failed; showing none`, err);
    return [];
  }
}

/** Memoise a read: it runs once, and every caller shares the promise. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => (pending ??= fn());
}

/** A meal plan's plan_data, or null when the read failed. */
type BlobRead = { planData: unknown } | null;

/**
 * Every read one family's sections share, each run at most once. Sections
 * take a reader instead of a user id so the header, the tabs and the panel
 * never issue the same query twice for the same request.
 */
interface FamilyReader {
  readonly userId: string;
  profile: () => Promise<ProfileRow | null>;
  auth: () => Promise<{ email: string | null; deactivated: boolean }>;
  subscriptions: () => Promise<SubscriptionDbRow[]>;
  members: () => Promise<MemberRow[]>;
  /** Every meal plan, newest first: the cheap columns only. */
  mealRows: () => Promise<MealRow[]>;
  /** Probes of the serve window (getLatestPlan's newest five non-archived rows), by id. */
  windowProbes: () => Promise<Map<string, MealProbeRow>>;
  /** The window's probes plus the newest MEAL_HISTORY_PROBED_ROWS rows', by id. */
  historyProbes: () => Promise<Map<string, MealProbeRow>>;
  /** One meal plan's blob; each id is read at most once per request. */
  mealBlob: (id: string) => Promise<BlobRead>;
  /** Every workout program, newest first, WITHOUT plan_data. */
  workoutRows: () => Promise<WorkoutRow[]>;
  /** Every generation run (meal and workout), newest first. */
  generations: () => Promise<GenerationRow[]>;
  chatStats: () => Promise<ChatStats>;
  /** getLatestPlan's decision for this family (reads the served blob). */
  servedMeal: () => Promise<ServedMeal | null>;
}

function createFamilyReader(userId: string): FamilyReader {
  const db = adminDb();
  const blobs = new Map<string, Promise<BlobRead>>();

  /** Probes of these rows, by id; a failed read degrades to none (the blob rule stands). */
  const probesOf = async (ids: readonly string[]): Promise<Map<string, MealProbeRow>> => {
    if (ids.length === 0) return new Map();
    try {
      const rows = await readByIdChunks(
        ids,
        (chunk) =>
          db
            .from("meal_plans")
            .select(MEAL_PROBE_ROW_COLUMNS)
            .eq("user_id", userId)
            .in("id", chunk)
            .returns<MealProbeRow[]>(),
        "meal_plan_probes",
      );
      return new Map(rows.map((r) => [r.id, r]));
    } catch (err) {
      warn("meal plan probes read failed; deciding without them", err);
      return new Map();
    }
  };

  const reader: FamilyReader = {
    userId,

    profile: once(async () => {
      const { data, error } = await db
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(`admin family profile: ${error.message}`);
      return (data as ProfileRow | null) ?? null;
    }),

    auth: once(async () => {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error) warn("auth user lookup failed", error);
      const user = data?.user as
        | { email?: string | null; banned_until?: string | null }
        | undefined;
      const bannedUntil = user?.banned_until ?? null;
      return {
        email: user?.email ?? null,
        deactivated: bannedUntil != null && new Date(bannedUntil).getTime() > Date.now(),
      };
    }),

    subscriptions: once(() =>
      readAll<SubscriptionDbRow>("subscriptions", (f, t) =>
        db
          .from("subscriptions")
          .select(SUBSCRIPTION_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(f, t),
      ),
    ),

    members: once(() =>
      readAll<MemberRow>("family_members", (f, t) =>
        db
          .from("family_members")
          .select(MEMBER_COLUMNS)
          .eq("user_id", userId)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true })
          .range(f, t)
          .returns<MemberRow[]>(),
      ),
    ),

    mealRows: once(() =>
      readAll<MealRow>("meal_plans", (f, t) =>
        db
          .from("meal_plans")
          .select(MEAL_ROW_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(f, t)
          .returns<MealRow[]>(),
      ),
    ),

    windowProbes: once(async () =>
      probesOf(mealServedWindow(await reader.mealRows()).map((r) => r.id)),
    ),

    historyProbes: once(async () => {
      const rows = await reader.mealRows();
      const inWindow = new Set(mealServedWindow(rows).map((r) => r.id));
      const rest = rows
        .slice(0, MEAL_HISTORY_PROBED_ROWS)
        .map((r) => r.id)
        .filter((id) => !inWindow.has(id));
      const [window, more] = await Promise.all([reader.windowProbes(), probesOf(rest)]);
      return new Map([...window, ...more]);
    }),

    mealBlob: (id) => {
      let read = blobs.get(id);
      if (!read) {
        read = fetchPlanData("meal_plans", userId, [id]).then((got) =>
          got ? { planData: got.get(id) ?? null } : null,
        );
        blobs.set(id, read);
      }
      return read;
    },

    workoutRows: once(() =>
      readAllOptional<WorkoutRow>("workout_plans", (f, t) =>
        db
          .from("workout_plans")
          .select("id, status, created_at, updated_at, generated_at, error_message, ai_model")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(f, t),
      ),
    ),

    generations: once(async () => {
      const rows = await readAll<GenerationRow>("plan_generations", (f, t) =>
        db
          .from("plan_generations")
          .select(
            "id, status, plan_kind, model, tokens_in, tokens_out, cost_usd, duration_ms, created_at, started_at, completed_at, error_message, meal_plan_id, workout_plan_id",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(f, t),
      );
      // Postgres numeric can arrive as a string.
      return rows.map((g) => ({ ...g, cost_usd: finiteNumber(g.cost_usd) }));
    }),

    chatStats: once(async () => {
      try {
        return await readChatStats(db, userId);
      } catch (err) {
        warn("chat_messages read failed; showing none", err);
        return NO_CHATS;
      }
    }),

    servedMeal: once(() => resolveServedMeal(reader)),
  };
  return reader;
}

/**
 * One reader per family per request (callers pass the lower-cased id, the form
 * Postgres returns). In a Server Component render, `cache()`
 * hands the page header and every streamed tab the SAME reader, so they share
 * its reads. A Route Handler has no render-scoped cache (React's cache() is a
 * pass-through there), which is why loadFamilyPanel takes one reader and
 * passes it to all four of its sections itself.
 */
const readerFor = cache(createFamilyReader);

/**
 * plan_data for a few rows of one family (the served plan, and the older
 * candidates getLatestPlan's fallback looks at). Null when the read failed, so
 * the caller can fall back to the probe-level decision instead of treating an
 * unreadable blob as a broken plan.
 */
async function fetchPlanData(
  table: "meal_plans" | "workout_plans",
  userId: string,
  ids: readonly string[],
): Promise<Map<string, unknown> | null> {
  if (ids.length === 0) return new Map();
  const { data, error } = await adminDb()
    .from(table)
    .select("id, plan_data")
    .eq("user_id", userId)
    .in("id", [...ids]);
  if (error) {
    warn(`${table} plan_data read failed`, error);
    return null;
  }
  return new Map((data ?? []).map((r) => [r.id, r.plan_data as unknown]));
}

/**
 * The advisor chat's count, newest message and cost — the three figures the
 * header shows — without bringing every row back in sequence. The count and
 * the newest message are one-row answers; the cost has no aggregate to ask
 * for (PostgREST's are off), so it sums the cost column alone: the first page
 * alongside the other two, the rest (a heavy household's thousands of
 * messages) together once the count says how many there are. Everything is
 * read as of one instant, so a message landing mid-read cannot be counted in
 * one figure and missed by another, or shift the pages under the sum.
 */
async function readChatStats(
  db: ReturnType<typeof adminDb>,
  userId: string,
): Promise<ChatStats> {
  const asOf = new Date().toISOString();
  const chats = () => db.from("chat_messages");
  const costPage = (page: number) =>
    chats()
      .select("cost_usd")
      .eq("user_id", userId)
      .lte("created_at", asOf)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);

  const [counted, newest, first] = await Promise.all([
    chats().select("id", { count: "exact", head: true }).eq("user_id", userId).lte("created_at", asOf),
    chats()
      .select("created_at")
      .eq("user_id", userId)
      .lte("created_at", asOf)
      .order("created_at", { ascending: false })
      .limit(1),
    costPage(0),
  ]);
  for (const read of [counted, newest, first]) {
    if (read.error) throw new Error(`chat_messages: ${read.error.message}`);
  }

  const count = counted.count ?? 0;
  const pages = Math.min(Math.ceil(count / PAGE), ROW_CEILING / PAGE);
  const rest = await mapWithConcurrency(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 1),
    async (page) => {
      const { data, error } = await costPage(page);
      if (error) throw new Error(`chat_messages: ${error.message}`);
      return data ?? [];
    },
  );
  let costUsd = 0;
  for (const row of [...(first.data ?? []), ...rest.flat()]) {
    costUsd += finiteNumber(row.cost_usd) ?? 0;
  }
  return { count, lastAt: newest.data?.[0]?.created_at ?? null, costUsd };
}

// ── Derived facts shared by several sections ────────────────────────────────

/** The ONE doctor-gate rule (plan-engine medicalGate.ts), exactly as the old detail page applied it. */
function ownerGate(p: ProfileRow): boolean {
  return (
    ownerRequiresDoctorSignOff({
      has_medical_conditions: p.has_medical_conditions,
      medical_conditions: p.medical_conditions,
      is_pregnant: p.is_pregnant,
    }) && p.consulted_doctor !== true
  );
}

function memberGate(m: MemberRow): boolean {
  return (
    memberRequiresDoctorSignOff({
      medical_conditions: m.medical_conditions,
      high_risk_pregnancy: m.high_risk_pregnancy,
    }) && m.consulted_doctor !== true
  );
}

/** Current names by member id — the plan keeps the name it was generated with. */
function namesById(profile: ProfileRow | null, members: readonly MemberRow[]): Map<string, string> {
  const map = new Map<string, string>();
  if (profile?.display_name) map.set("mom", profile.display_name);
  for (const m of members) if (m.name) map.set(m.id, m.name);
  return map;
}

/** The live roster /plan reads the served plan against (displayMealPlan). */
function displayRoster(profile: ProfileRow, members: readonly MemberRow[]): MealDisplayRoster {
  return {
    mom: { member_type: profile.member_type, birth_year: profile.birth_year },
    members: members.map((m) => ({
      id: m.id,
      member_type: m.member_type,
      birth_year: m.birth_year,
    })),
  };
}

function sumCostBy(gens: readonly GenerationRow[], key: "meal_plan_id" | "workout_plan_id") {
  const out = new Map<string, number>();
  for (const g of gens) {
    const id = g[key];
    if (!id || g.cost_usd == null) continue;
    out.set(id, (out.get(id) ?? 0) + g.cost_usd);
  }
  return out;
}

const roundUsd = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/** Creation time of the newest non-archived row (rows are newest first). */
const newestLive = (rows: readonly { status: string; created_at: string }[]) =>
  rows.find((r) => r.status !== "archived")?.created_at ?? null;

// ── Header ──────────────────────────────────────────────────────────────────

/**
 * What the household is served, as the run flags read it — the blob
 * decision the Meal tab and the household table read too.
 */
function servedMealCell(served: ServedMeal | null): ServedCellLike {
  return served ? { state: served.state, masked: served.masked } : { state: "none", masked: false };
}

/**
 * Identity, billing, flags and totals. Household count, plan counts, last
 * activity and lifetime cost are built by the families list's own function
 * (subscriberRowOf), and the flags and the cancellation state by its own
 * rule (familyStateOf). What the household is served is the app's decision
 * on the blob (servedMeal) — the one the Meal tab shows — where the list,
 * which reads no blobs, approximates it from probes. So the page never flags
 * a run failed under a Meal tab that shows the plan served and fine.
 */
async function buildHeader(reader: FamilyReader): Promise<FamilyHeaderData | null> {
  const userId = reader.userId;
  const [profile, auth, subs, members, mealRows, workoutRows, gens, chat, served] =
    await Promise.all([
      reader.profile(),
      reader.auth(),
      reader.subscriptions(),
      reader.members(),
      reader.mealRows(),
      reader.workoutRows(),
      reader.generations(),
      reader.chatStats(),
      reader.servedMeal(),
    ]);
  if (!profile) return null;

  const now = Date.now();
  const row = subscriberRowOf({
    profile,
    subscription: subs[0] ?? null,
    email: auth.email,
    members,
    plans: mealRows,
    generationCostUsd: gens.reduce((s, g) => s + (g.cost_usd ?? 0), 0),
    chat: { costUsd: chat.costUsd, lastAt: chat.lastAt },
  });
  const meal = servedMealCell(served);
  const workout = workoutCellFromRows(workoutRows, now);
  const newestRun = newestGenerationByKind(gens);
  const { flags, cancelState } = familyStateOf({ row, meal, workout, newestRun, nowMs: now });

  const subscriptionHistory = subs.map(mapSubscription);
  const subscription = subscriptionHistory[0] ?? null;
  const tier = subscription?.tier;
  const tierMaxPeople =
    tier && tier in PRICING_TIERS ? PRICING_TIERS[tier as Tier].max_people : null;
  const medicalGateBlocked = ownerGate(profile) || members.some(memberGate);

  return {
    userId,
    displayName: profile.display_name,
    email: auth.email,
    deactivated: auth.deactivated,
    preferredLanguage: profile.preferred_language,
    signupAt: profile.created_at,
    onboardingCompletedAt: profile.onboarding_completed_at,
    familyWideCompletedAt: profile.family_wide_completed_at,
    momProfileCompletedAt: profile.mom_profile_completed_at,
    subscription,
    subscriptionHistory,
    beneficiaries: row.beneficiaries,
    hasHousekeeper: row.hasHousekeeper,
    tierMaxPeople,
    overLimit: row.overLimit,
    flags,
    cancelState,
    medicalGateBlocked,
    reasons: attentionReasons({
      flags,
      medicalGateBlocked,
      subscription,
      beneficiaries: row.beneficiaries,
      maxPeople: tierMaxPeople,
      mealFailureAt: runFailureAt(newestRun.meal, meal, newestLive(mealRows)),
      workoutFailureAt: runFailureAt(newestRun.workout, workout, newestLive(workoutRows)),
      meal,
      workout,
    }),
    lifetimeAiCostUsd: row.lifetimeAiCostUsd,
    lastActivityAt: row.lastActivityAt,
    engagement: {
      chatCount: chat.count,
      lastChatAt: chat.lastAt,
      chatCostUsd: roundUsd(chat.costUsd),
    },
  };
}

export const loadFamilyHeader = cache(
  async (userId: string): Promise<FamilyHeaderData | null> =>
    isUuid(userId) ? buildHeader(readerFor(userId.toLowerCase())) : null,
);

// ── Meal plan ───────────────────────────────────────────────────────────────

interface ServedMeal {
  rowId: string;
  state: "generating" | "ready" | "failed";
  /**
   * The served plan as /plan displays it (displayMealPlan): the validated
   * plan, or a live run's snapshot; null when there is nothing to show, or
   * its blob could not be read.
   */
  planData: unknown;
  masked: boolean;
  maskedFailureAt: string | null;
}

/**
 * getLatestPlan's decision for one family (see mealProjection.ts). Reads the
 * newest row's blob when it can hold one. Only when the newest run failed with
 * nothing to show does it look further back — getLatestPlan's own loop, in its
 * own order: the older 'ready' rows of the window, newest first, read ONE
 * blob at a time and tested with the app's rule (schema, content in ANY
 * member, staleness), stopping at the first it would serve. So the common
 * case (the previous week is fine) costs one read, however many failures are
 * stacked in front of it.
 *
 * The only older rows skipped unread are those whose probes PROVE the schema
 * would reject them (`probeMayHoldPlan`: no first member, no week). A row
 * whose FIRST member has no meals is still read: the app serves it when any
 * other member has meals — the probes, which see the first member only,
 * cannot tell that from an empty shell. (The families list, which has only
 * the probes, does take that first-member approximation; see
 * `pickServedMealLite`.)
 *
 * If a blob read fails, the probe-level decision stands in (state known, no
 * week to project): for the newest row, the list's rule over the window; for
 * the older candidates, the list's rule over the ones not yet ruled out — the
 * first whose probes show meals is served — with no further reads.
 *
 * The state is decided on the plan as getLatestPlan holds it; what is
 * returned to project is the plan as /plan then displays it.
 */
async function resolveServedMeal(reader: FamilyReader): Promise<ServedMeal | null> {
  const [rows, probes, profile, members] = await Promise.all([
    reader.mealRows(),
    reader.windowProbes(),
    reader.profile(),
    reader.members(),
  ]);
  // A probe read is the newer read of its row: its status and clock stand.
  const live = (r: MealRow): MealRow => {
    const probe = probes.get(r.id);
    return probe ? { ...r, status: probe.status, updated_at: probe.updated_at } : r;
  };
  const window = mealServedWindow(rows.map(live));
  const newest = window[0];
  if (!newest) return null;
  const now = Date.now();
  const display = (planData: unknown): unknown =>
    planData == null || !profile ? planData : displayMealPlan(planData, displayRoster(profile, members));

  const fromProbes = (): ServedMeal | null => {
    const pick = pickServedMealLite(
      window.map((r) => withProbe(r, probes.get(r.id))),
      now,
    );
    if (!pick.served || !pick.resolution) return null;
    return {
      rowId: pick.served.id,
      state: mealStateOf(pick.resolution),
      planData: null,
      masked: pick.masked,
      maskedFailureAt: pick.maskedFailure?.created_at ?? null,
    };
  };

  const blobs = new Map<string, unknown>();
  /** Reads one row's plan_data into `blobs`; false when the read failed. */
  const readBlob = async (id: string): Promise<boolean> => {
    const got = await reader.mealBlob(id);
    if (!got) return false;
    blobs.set(id, got.planData);
    return true;
  };
  if (newest.status === "ready" || newest.status === "generating") {
    if (!(await readBlob(newest.id))) return fromProbes();
  }
  const full = (r: MealRow): MealPlanRowFull => ({
    id: r.id,
    status: r.status,
    plan_data: blobs.get(r.id) ?? null,
    generated_at: r.generated_at,
    error_message: r.error_message,
    updated_at: r.updated_at,
  });

  const resolvedNewest = resolveMealRow(full(newest), now);
  if (!resolvedNewest) return null;
  let pick = pickServedMealPlan(resolvedNewest, [], now);
  if (needsPreviousPlan(resolvedNewest)) {
    const candidates = window.slice(1).filter((r) => {
      if (r.status !== "ready") return false;
      // Unprobed (the probe read failed): the blob decides.
      const probe = probes.get(r.id);
      return !probe || probeMayHoldPlan(probe);
    });
    for (const [i, candidate] of candidates.entries()) {
      if (!(await readBlob(candidate.id))) {
        // The blob path is down: the list's probe rule decides among the
        // candidates not yet ruled out, without reading any more.
        const onProbes = candidates.slice(i).find((r) => {
          const probe = probes.get(r.id);
          return probe ? daysReadyFromProbe(probe) > 0 : true;
        });
        if (!onProbes) break;
        return {
          rowId: onProbes.id,
          state: "ready",
          planData: null,
          masked: true,
          maskedFailureAt: newest.created_at,
        };
      }
      // The app's own test (schema, content in any member, staleness) on this one row.
      const attempt = pickServedMealPlan(resolvedNewest, [full(candidate)], now);
      if (attempt.masked) {
        pick = attempt;
        break;
      }
      blobs.delete(candidate.id); // passed over: never needed again here
    }
  }

  const served = pick.served;
  const hasContent = !!served.planData && planHasContent(served.planData);
  return {
    rowId: served.id,
    state: mealStateOf({ status: served.status, inProgress: served.inProgress, hasContent }),
    // A live run's rows are read with no validated plan (getLatestPlan's rule);
    // the admin still projects the snapshot so the operator can watch days land.
    planData: display(
      served.planData ?? (served.status === "generating" ? (blobs.get(served.id) ?? null) : null),
    ),
    masked: pick.masked,
    maskedFailureAt: pick.masked ? newest.created_at : null,
  };
}

/**
 * A history row. Its day count is the FIRST beneficiary's, from its probes —
 * an approximation the list shares — or null (unknown) past the probed rows.
 * The served plan's row is corrected to the household's count by
 * buildMealSection, which has its blob.
 */
function toMealItem(
  r: MealRow,
  probe: MealProbeRow | null,
  costByPlan: ReadonlyMap<string, number>,
): MealPlanListItem {
  const cost = costByPlan.get(r.id);
  return {
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    generatedAt: r.generated_at,
    daysReady: probe ? daysReadyFromProbe(probe) : null,
    daysTotal: probe ? daysTotalFromProbe(probe) : DEFAULT_DAYS_TOTAL,
    aiInputTokens: r.ai_input_tokens,
    aiOutputTokens: r.ai_output_tokens,
    aiModel: r.ai_model,
    costUsd: cost === undefined ? null : roundUsd(cost),
  };
}

/**
 * The served meal plan (with a compact week) and every plan's history row.
 * `served.plan.status` is the RESOLVED state (generating / ready / failed —
 * what the household sees), not the raw column; `plans[]` keep the raw one.
 *
 * The served plan's days ready are the HOUSEHOLD's — the days every member
 * has (householdDaysReady), read off the same blob as its week — in the
 * summary and on its history row alike: a short week for one member (added
 * mid-week, or failing until the retry cap ships the week short) is the week
 * an operator most needs to see, and the first member's count would call it
 * complete. Only without a week to read (no members yet, or an unreadable
 * blob) does the probe count stand in.
 */
async function buildMealSection(reader: FamilyReader): Promise<MealSection> {
  const [rows, probes, gens, served, profile, members] = await Promise.all([
    reader.mealRows(),
    reader.historyProbes(),
    reader.generations(),
    reader.servedMeal(),
    reader.profile(),
    reader.members(),
  ]);
  const costByPlan = sumCostBy(gens, "meal_plan_id");
  const items = rows.map((r) => toMealItem(r, probes.get(r.id) ?? null, costByPlan));
  if (!served) return { served: null, plans: items };

  const week = projectMealWeek(served.planData, {
    generating: served.state === "generating",
    nameById: namesById(profile, members),
  });
  const householdDays = householdDaysReady(week);
  const plans =
    week && householdDays !== null
      ? items.map((p) =>
          p.id === served.rowId ? { ...p, daysReady: householdDays, daysTotal: week.daysTotal } : p,
        )
      : items;

  const item = plans.find((p) => p.id === served.rowId);
  if (!item) return { served: null, plans };
  return {
    served: {
      plan: { ...item, status: served.state },
      week,
      masked: served.masked,
      maskedFailureAt: served.maskedFailureAt,
    },
    plans,
  };
}

export const loadMealSection = cache(
  async (userId: string): Promise<MealSection> =>
    isUuid(userId)
      ? buildMealSection(readerFor(userId.toLowerCase()))
      : { served: null, plans: [] },
);

// ── Exercise plan ───────────────────────────────────────────────────────────

function toWorkoutItem(
  r: WorkoutRow,
  costByPlan: ReadonlyMap<string, number>,
): WorkoutPlanListItem {
  const cost = costByPlan.get(r.id);
  return {
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    generatedAt: r.generated_at,
    updatedAt: r.updated_at,
    errorMessage: r.error_message,
    traineeCount: null,
    sessionsPerWeek: null,
    aiModel: r.ai_model,
    costUsd: cost === undefined ? null : roundUsd(cost),
  };
}

const EMPTY_WORKOUT: WorkoutSection = {
  optedIn: false,
  served: null,
  latest: null,
  waitingForMeals: false,
  plans: [],
  ineligible: [],
  marksWindow: null,
};

/**
 * The served program (getLatestWorkoutPlan's rule — the app's own
 * pickServedWorkoutRow), this week's session marks, who opted in, and who is
 * never included. `latest` is the newest row with its RESOLVED status (a dead
 * run reads failed, as the household sees it); `plans[]` keep the raw status.
 */
async function buildWorkoutSection(reader: FamilyReader): Promise<WorkoutSection> {
  const userId = reader.userId;
  // THIS week only (Sunday → today, Riyadh), not the app's marking window,
  // which on a Sunday or Monday reaches back into last Friday and Saturday —
  // marks are keyed by weekday, so those would land on this week's sessions.
  // The marks depend on nothing else, so their read starts with the rows'
  // rather than after the program's blob; it is awaited only when a program
  // is served (and never rejects).
  const marksWindow = currentTrainingWeek(riyadhTodayISO());
  const checkinsRead = loadWorkoutCheckins(userId, marksWindow.start, marksWindow.end);
  const [profile, members, rows, gens] = await Promise.all([
    reader.profile(),
    reader.members(),
    reader.workoutRows(),
    reader.generations(),
  ]);
  if (!profile) return EMPTY_WORKOUT;

  const now = Date.now();
  const costByPlan = sumCostBy(gens, "workout_plan_id");
  const plans = rows.map((r) => toWorkoutItem(r, costByPlan));
  const ineligible = workoutIneligibleMembers(
    {
      owner: { name: profile.display_name ?? "—", birthYear: profile.birth_year },
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        memberType: m.member_type,
        birthYear: m.birth_year,
      })),
    },
    riyadhCurrentYear(),
  );
  const optedIn = profile.workout_profile != null || members.some((m) => m.workout_profile != null);

  const window = rows.filter((r) => r.status !== "archived").slice(0, WORKOUT_SERVED_WINDOW);
  const newest = window[0];
  if (!newest) return { ...EMPTY_WORKOUT, optedIn, plans, ineligible };

  // Resolve the newest row and, when it failed with nothing to show, fall back
  // to the last ready program — with the app's own functions on real blobs.
  let latestStatus: ResolvedStatus;
  let latestError: string | null = newest.error_message;
  let served: ResolvedWorkoutRow | null = null;
  // Set instead of `served` when a blob read FAILED: the program the household
  // is served, decided on the row columns alone (the list's rule — the meal
  // side's fromProbes twin). State and masking stay right; there is no program
  // to project, so it is returned with no trainees and no figures.
  let servedFromColumns: { row: WorkoutRow; masked: boolean } | null = null;
  const blobs = new Map<string, unknown>();
  const full = (r: WorkoutRow): WorkoutPlanRow => ({
    id: r.id,
    status: r.status,
    plan_data: blobs.get(r.id) ?? null,
    error_message: r.error_message,
    updated_at: r.updated_at,
  });
  const newestBlob =
    newest.status === "ready"
      ? await fetchPlanData("workout_plans", userId, [newest.id])
      : new Map<string, unknown>();
  if (!newestBlob) {
    const lite = pickServedWorkoutLite(window, now);
    latestStatus = resolveWorkoutRowLite(newest, now).status;
    if (lite.served && lite.status === "ready") {
      servedFromColumns = { row: lite.served, masked: lite.masked };
    }
  } else {
    for (const [k, v] of newestBlob) blobs.set(k, v);
    const latest = resolveWorkoutRow(full(newest), now, STALE_GENERATION_MIN);
    latestStatus = latest?.status ?? "failed";
    latestError = latest?.error_message ?? latestError;
    served = latest;
    if (latest && latest.status === "failed" && !latest.plan_data) {
      // The older READY programs, ONE blob at a time, newest first, stopping
      // at the first the app would serve (its own pickServedWorkoutRow, asked
      // about this one row) — never every older program at once. Workout rows
      // carry no plan_data probes; a row only turns 'ready' on its final
      // write, with the finished program in it, so status is the pre-filter.
      const candidates = window.slice(1).filter((r) => r.status === "ready");
      // The newest is already resolved (failed, nothing to show); handing the
      // rule that fact spares re-resolving — and re-logging — it per candidate.
      const failedNewest: WorkoutPlanRow = { ...full(newest), status: "failed", plan_data: null };
      for (const candidate of candidates) {
        const got = await fetchPlanData("workout_plans", userId, [candidate.id]);
        if (!got) {
          // The newest run is known to have failed (its row was read); this
          // older program is unreadable, so it is served on its columns.
          served = null;
          servedFromColumns = { row: candidate, masked: true };
          break;
        }
        for (const [k, v] of got) blobs.set(k, v);
        const pick = pickServedWorkoutRow(
          [failedNewest, full(candidate)],
          now,
          STALE_GENERATION_MIN,
        );
        if (pick && pick.id === candidate.id) {
          served = pick;
          break;
        }
      }
    }
  }

  const liveMealRun = gens.some((g) => {
    if (generationKind(g.plan_kind) !== "meal" || g.status !== "started") return false;
    const startedMs = Date.parse(g.started_at ?? g.created_at);
    return Number.isFinite(startedMs) && (now - startedMs) / 60_000 < STALE_GENERATION_MIN;
  });
  const waitingForMeals = latestStatus === "generating" && liveMealRun;

  const latestItem: WorkoutPlanListItem = {
    ...(plans.find((p) => p.id === newest.id) ?? toWorkoutItem(newest, costByPlan)),
    status: latestStatus,
    errorMessage: latestError,
  };

  if (servedFromColumns) {
    const { row, masked } = servedFromColumns;
    const item = plans.find((p) => p.id === row.id) ?? toWorkoutItem(row, costByPlan);
    return {
      optedIn,
      served: { plan: { ...item, status: "ready" }, trainees: [], masked },
      latest: latestItem,
      waitingForMeals,
      plans,
      ineligible,
      marksWindow: null,
    };
  }

  const program = served?.plan_data ?? null;
  if (!served || !program) {
    return {
      optedIn,
      served: null,
      latest: latestItem,
      waitingForMeals,
      plans,
      ineligible,
      marksWindow: null,
    };
  }

  const stats = workoutPlanStats(program);
  const withStats = (p: WorkoutPlanListItem): WorkoutPlanListItem =>
    p.id === served.id ? { ...p, ...stats } : p;

  const roster = new Map<string, WorkoutRosterEntry>();
  roster.set("mom", {
    memberId: "mom",
    name: profile.display_name ?? "",
    role: "mom",
    sex: sexOf(profile.sex),
    workoutProfile: profile.workout_profile,
  });
  for (const m of members) {
    roster.set(m.id, {
      memberId: m.id,
      name: m.name,
      role: m.role,
      sex: sexOf(m.sex),
      workoutProfile: m.workout_profile,
    });
  }
  const trainees: WorkoutTraineeView[] = projectWorkoutTrainees(
    program,
    roster,
    marksByMemberDay(await checkinsRead, marksWindow.start),
  );

  const servedItem =
    plans.find((p) => p.id === served.id) ??
    toWorkoutItem(rows.find((r) => r.id === served.id) ?? newest, costByPlan);

  return {
    optedIn,
    served: {
      plan: withStats({ ...servedItem, status: served.status, errorMessage: served.error_message }),
      trainees,
      masked: served.id !== newest.id,
    },
    latest: withStats(latestItem),
    waitingForMeals,
    plans: plans.map(withStats),
    ineligible,
    marksWindow,
  };
}

export const loadWorkoutSection = cache(
  async (userId: string): Promise<WorkoutSection> =>
    isUuid(userId) ? buildWorkoutSection(readerFor(userId.toLowerCase())) : EMPTY_WORKOUT,
);

/**
 * Session marks between two Riyadh dates (the loader passes this week's
 * Sunday → today), read the way /plan reads them: by user and date
 * (calendar-keyed), NOT by workout_plan_id — a re-dispatch mints a new program
 * row and a plan-id read would drop every earlier mark. Untyped client:
 * workout_checkins (00020) and its intensity column (00022) are not in the
 * generated Database types. Never rejects: it is started before anyone knows
 * whether a program will need it.
 */
async function loadWorkoutCheckins(userId: string, start: string, end: string) {
  try {
    const { data, error } = await (adminDb() as unknown as SupabaseClient)
      .from("workout_checkins")
      .select("*")
      .eq("user_id", userId)
      .gte("local_date", start)
      .lte("local_date", end)
      .order("created_at", { ascending: true })
      .limit(800);
    if (error) {
      warn("workout_checkins read failed; showing no marks", error);
      return [];
    }
    return toRawWorkoutRows((data ?? []) as unknown[]);
  } catch (err) {
    warn("workout_checkins read failed; showing no marks", err);
    return [];
  }
}

// ── Runs ────────────────────────────────────────────────────────────────────

/** Every generation run, meal and workout, newest first. */
export const loadRuns = cache(async (userId: string): Promise<RunRow[]> => {
  if (!isUuid(userId)) return [];
  const gens = await readerFor(userId.toLowerCase()).generations();
  return gens.map((g) => ({
    id: g.id,
    kind: generationKind(g.plan_kind),
    status: g.status,
    model: g.model,
    tokensIn: g.tokens_in,
    tokensOut: g.tokens_out,
    costUsd: g.cost_usd,
    durationMs: g.duration_ms,
    createdAt: g.created_at,
    completedAt: g.completed_at,
    errorMessage: g.error_message,
    mealPlanId: g.meal_plan_id,
    workoutPlanId: g.workout_plan_id,
  }));
});

// ── Household ───────────────────────────────────────────────────────────────

/** A plan states a target for this member (a goal alone is not one). */
const hasTargets = (t: MemberPlanTargets | undefined): t is MemberPlanTargets =>
  !!t && (t.caloriesTarget !== null || t.macros !== null);

/**
 * Targets from the newest plan, other than the one served, that has members
 * — the latest the engine computed for whoever the served plan does not
 * cover. A new run states none until its skeleton lands (minutes into a
 * family's run), and a run that died with nothing to show is served with no
 * plan at all, though its own row may still hold the targets its skeleton
 * wrote; the old detail page showed the newest plan with members, so it
 * never went blank. Rows are taken newest first from the serve window, the
 * served row itself only when it gave no plan; the probes rule out rows with
 * no members unread, so this costs one blob read, and only when needed.
 */
async function earlierPlanTargets(
  reader: FamilyReader,
  served: ServedMeal | null,
  roster: MealDisplayRoster,
): Promise<Map<string, MemberPlanTargets>> {
  const [rows, probes] = await Promise.all([reader.mealRows(), reader.windowProbes()]);
  const source = mealServedWindow(rows).find((r) => {
    if (served && r.id === served.rowId && served.planData != null) return false;
    const probe = probes.get(r.id);
    return !!probe && probeMayHoldPlan(probe);
  });
  if (!source) return new Map();
  const blob = await reader.mealBlob(source.id);
  return blob ? planTargetsById(displayMealPlan(blob.planData, roster)) : new Map();
}

/**
 * Owner first, then members by display_order. Goal, calories and macros come
 * from the served meal plan as /plan displays it (a child's figures are the
 * average of their real days); a beneficiary that plan gives no target —
 * every one of them while a new run is still planning — takes the newest
 * earlier plan's (earlierPlanTargets); a goal with no plan behind it falls
 * back to the stored one. `memberType` is adult / child / housekeeper only —
 * pregnancy and lactation are not a member type here.
 *
 * NOT fully minimised, and knowingly so: `primaryGoal` is the exact goal,
 * and the plan's goal can itself be health-derived — 'pregnancy_lactation',
 * 'metabolic_health', 'digestive_health' — so this payload can still tell a
 * pregnancy or a condition-led plan apart. The owner keeps the exact goal
 * (spec §6: parity with the old detail page, which showed it); see the
 * privacy note at the top of console-types.ts.
 */
async function buildHousehold(reader: FamilyReader): Promise<HouseholdMember[]> {
  const [profile, members, served] = await Promise.all([
    reader.profile(),
    reader.members(),
    reader.servedMeal(),
  ]);
  if (!profile) return [];

  const targets = planTargetsById(served?.planData ?? null);
  const beneficiaries = ["mom", ...members.filter((m) => m.role !== "housekeeper").map((m) => m.id)];
  if (beneficiaries.some((id) => !hasTargets(targets.get(id)))) {
    const earlier = await earlierPlanTargets(reader, served, displayRoster(profile, members));
    for (const id of beneficiaries) {
      const fallback = earlier.get(id);
      if (!hasTargets(targets.get(id)) && hasTargets(fallback)) targets.set(id, fallback);
    }
  }
  const year = riyadhCurrentYear();
  const ageOf = (birthYear: number | null) =>
    birthYear != null && Number.isFinite(birthYear) ? year - birthYear : null;

  const mom = targets.get("mom");
  const owner: HouseholdMember = {
    id: "mom",
    name: profile.display_name ?? "—",
    role: "mom",
    memberType: "adult",
    isHousekeeper: false,
    pickyEater: null,
    primaryGoal: mom?.primaryGoal ?? profile.primary_goal ?? null,
    caloriesTarget: mom?.caloriesTarget ?? null,
    macros: mom?.macros ?? null,
    medicalGate: ownerGate(profile),
    consultedDoctor: profile.consulted_doctor ?? null,
    age: ageOf(profile.birth_year),
  };

  const rest: HouseholdMember[] = members.map((m) => {
    const t = targets.get(m.id);
    const isHousekeeper = m.role === "housekeeper";
    const summary: MemberSummary = {
      id: m.id,
      name: m.name,
      role: m.role,
      memberType:
        isHousekeeper || m.member_type === "housekeeper"
          ? "housekeeper"
          : m.member_type === "child"
            ? "child"
            : "adult",
      isHousekeeper,
      pickyEater: m.picky_eater ?? null,
      primaryGoal: t?.primaryGoal ?? m.primary_goal ?? null,
      caloriesTarget: t?.caloriesTarget ?? null,
      macros: t?.macros ?? null,
      medicalGate: memberGate(m),
      consultedDoctor: m.consulted_doctor ?? null,
    };
    return { ...summary, age: ageOf(m.birth_year) };
  });

  return [owner, ...rest];
}

export const loadHousehold = cache(
  async (userId: string): Promise<HouseholdMember[]> =>
    isUuid(userId) ? buildHousehold(readerFor(userId.toLowerCase())) : [],
);

// ── The side panel ──────────────────────────────────────────────────────────

/** Everything the side panel shows, in one response. Null = no such family. */
export const loadFamilyPanel = cache(async (userId: string): Promise<FamilyPanelData | null> => {
  if (!isUuid(userId)) return null;
  // ONE reader for all four sections — see readerFor.
  const reader = readerFor(userId.toLowerCase());
  const [header, meal, workout, household] = await Promise.all([
    buildHeader(reader),
    buildMealSection(reader),
    buildWorkoutSection(reader),
    buildHousehold(reader),
  ]);
  if (!header) return null;
  return { header, meal, workout, household };
});

// ── The program view page ───────────────────────────────────────────────────

/**
 * One workout program's full plan_data for the view page — the workout twin
 * of loadPlanForInspect, with the same ownership guard: the program must
 * belong to the family named in the URL.
 */
export const loadWorkoutForInspect = cache(
  async (userId: string, planId: string): Promise<PlanInspect | null> => {
    if (!isUuid(userId) || !isUuid(planId)) return null;
    const { data, error } = await adminDb()
      .from("workout_plans")
      .select("id, user_id, status, created_at, generated_at, plan_data")
      .eq("id", planId)
      .maybeSingle();
    if (error) throw new Error(`admin workout inspect: ${error.message}`);
    if (!data || data.user_id !== userId.toLowerCase()) return null;
    return {
      id: data.id,
      status: data.status,
      createdAt: data.created_at,
      generatedAt: data.generated_at,
      planData: data.plan_data,
    };
  },
);
