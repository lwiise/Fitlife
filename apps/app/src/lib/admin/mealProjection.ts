/**
 * Meal plans for the admin console — which plan a household is served, and a
 * compact, display-only projection of it. Pure (no I/O); the server loaders
 * (queries.ts, family.ts) feed it rows and blobs.
 *
 * Two readers, one rule. The customer app decides what a household sees with
 * `getLatestPlan` (lib/plans/getLatestPlan.ts): the newest non-archived row,
 * read through `resolveStaleness`, unless that row failed with nothing to show
 * and an older READY plan in the newest five still has meals — then the older
 * plan is served (the "masked failure"). The admin must report exactly that,
 * or an operator reads "no plan" for a household that is cooking from last
 * week's (or "ready" for one staring at a retry card).
 *
 *  - `resolveMealRow` + `pickServedMealPlan` run that rule on FULL rows
 *    (plan_data in hand) with the app's own building blocks — MealPlanSchema,
 *    planHasContent, resolveStaleness, workerAckedFromPlanData. The family
 *    page uses them, one family at a time.
 *  - `mealCellFromRows` runs the same rule on PROBE rows — a few JSON-path
 *    columns instead of the multi-hundred-KB blob — because the families list
 *    covers every household at once. It cannot run the Zod validation (it
 *    never sees the blob), so it assumes a 'ready' row's data is valid; every
 *    other branch is the app's, pinned against `resolveStaleness` by
 *    mealProjection.test.ts so the two cannot drift silently.
 *
 * getLatestPlan itself is server-only and reads through a cookie-bound client,
 * so it cannot be called from the admin; the fallback loop is mirrored here
 * line for line (see the comments that point back at it).
 */

import { MealPlanSchema, planHasContent, type MealPlan } from "@fitlife/plan-engine";
import { resolveStaleness, STALE_GENERATION_MIN } from "@/lib/plans/staleness";
import { WORKER_ACK_LIMIT_MS, workerAckedFromPlanData } from "@/lib/plans/generationTiming";
import type {
  MealPlanCell,
  PlanCellState,
  MealWeekDay,
  MealWeekMeal,
  MealWeekMember,
  MealWeekProjection,
} from "./console-types";

/** getLatestPlan's look-back window (a failed run can stack on another). */
export const MEAL_SERVED_WINDOW = 5;

/** A week has seven days unless the plan says otherwise. */
export const DEFAULT_DAYS_TOTAL = 7;

// ── Probes ──────────────────────────────────────────────────────────────────

const DAY_PROBE_KEYS = ["d0", "d1", "d2", "d3", "d4", "d5", "d6"] as const;

/**
 * JSON-path columns that stand in for `plan_data` wherever only its shape
 * matters. `dN` is the first meal's slot on the FIRST member's N-th day —
 * non-null exactly when that day has at least one meal. (Probing the day's
 * `day_index` instead would count the empty day SHELLS the engine writes for
 * days it has not generated yet, so a plan with one real day would read 7/7.)
 * The first member stands in for the household: days are generated for the
 * whole household together, and a member added later is appended at the end.
 *
 * `ack`, `ws` and `m0` only exist to answer "has the worker ever written this
 * row" (see `workerAckedFromProbe`).
 */
export const MEAL_PROBE_COLUMNS = [
  "days_total:plan_data->days_total",
  "generating:plan_data->generating",
  "ack:plan_data->worker_ack_at",
  "ws:plan_data->week_start_date",
  "m0:plan_data->members->0->member_id",
  ...DAY_PROBE_KEYS.map((k, i) => `${k}:plan_data->members->0->days->${i}->meals->0->slot`),
].join(", ");

/** The values `MEAL_PROBE_COLUMNS` returns (JSON, so each may be anything). */
export interface MealProbeFields {
  days_total?: unknown;
  generating?: unknown;
  ack?: unknown;
  ws?: unknown;
  m0?: unknown;
  d0?: unknown;
  d1?: unknown;
  d2?: unknown;
  d3?: unknown;
  d4?: unknown;
  d5?: unknown;
  d6?: unknown;
}

const present = (v: unknown): boolean => v !== null && v !== undefined;

/** Days with meals for the first beneficiary, from the probes. */
export function daysReadyFromProbe(p: MealProbeFields): number {
  let n = 0;
  for (const k of DAY_PROBE_KEYS) if (present(p[k])) n += 1;
  return n;
}

/** plan_data.days_total, defaulting to a full week. */
export function daysTotalFromProbe(p: MealProbeFields | null | undefined): number {
  return positiveInt(p?.days_total) ?? DEFAULT_DAYS_TOTAL;
}

/**
 * `workerAckedFromPlanData` over probes: the worker has written the row once
 * plan_data carries ANY key — its ACK stamp, or a real snapshot (which always
 * has members/week_start_date). All-null probes = the `{}` createPlanRows
 * inserted. The one input probes cannot tell from `{}` is an SQL NULL
 * plan_data, which createPlanRows never writes.
 */
export function workerAckedFromProbe(p: MealProbeFields): boolean {
  return (
    present(p.ack) ||
    present(p.ws) ||
    present(p.m0) ||
    present(p.days_total) ||
    present(p.generating) ||
    DAY_PROBE_KEYS.some((k) => present(p[k]))
  );
}

/**
 * The probe values a plan_data blob WOULD return — used by the tests to prove
 * the probe path and the full path agree, and handy wherever a blob is at hand.
 */
export function probeFromPlanData(planData: unknown): MealProbeFields {
  const pd = asRecord(planData);
  if (!pd) return {};
  const first = asRecord(Array.isArray(pd.members) ? pd.members[0] : undefined);
  const days = first && Array.isArray(first.days) ? first.days : [];
  const out: MealProbeFields = {
    days_total: pd.days_total ?? null,
    generating: pd.generating ?? null,
    ack: pd.worker_ack_at ?? null,
    ws: pd.week_start_date ?? null,
    m0: first?.member_id ?? null,
  };
  DAY_PROBE_KEYS.forEach((k, i) => {
    const day = asRecord(days[i]);
    const meals = day && Array.isArray(day.meals) ? day.meals : [];
    out[k] = asRecord(meals[0])?.slot ?? null;
  });
  return out;
}

// ── The served plan on probe rows (the families list) ───────────────────────

/** A meal_plans row as the list sees it. `probe` is null outside the probe window. */
export interface MealRowLite {
  id: string;
  status: string;
  created_at: string;
  /** Null when the row is outside the probe window. */
  updated_at: string | null;
  probe: MealProbeFields | null;
}

export type ResolvedStatus = "generating" | "ready" | "failed";

interface LiteResolution {
  status: ResolvedStatus;
  /** resolveStaleness would hand back plan data with meals in it. */
  hasContent: boolean;
  /** A ready plan still flagged generating (or an empty ready shell), fresh. */
  inProgress: boolean;
}

/**
 * `resolveStaleness` over probes, without its logging (the list runs it for
 * every household on every request). Mirrors getLatestPlan's inputs too: only
 * a 'ready' row carries plan data into the rule — a 'generating' row is read
 * with `planData: null` there, so it never "has content" here either.
 */
export function resolveMealRowLite(row: MealRowLite, nowMs: number): LiteResolution {
  const status = row.status as ResolvedStatus;
  const probe = row.probe;

  if (status === "failed") return { status: "failed", hasContent: false, inProgress: false };

  // No probe: the row is older than the probe window, or was inserted between
  // the list's two reads. A 'ready' row is taken at its word. A 'generating'
  // row brings no content (the app reads it with planData null), so it fails
  // once it is older than the staleness window — measured from created_at,
  // the only clock available, which is exact for the old rows (silent for
  // weeks) and generous for a just-inserted one (it is still starting).
  if (!probe) {
    if (status === "ready") return { status: "ready", hasContent: true, inProgress: false };
    const createdMs = Date.parse(row.created_at);
    const ageMin = Number.isNaN(createdMs) ? Infinity : (nowMs - createdMs) / 60_000;
    return ageMin < STALE_GENERATION_MIN
      ? { status: "generating", hasContent: false, inProgress: false }
      : { status: "failed", hasContent: false, inProgress: false };
  }

  const hasContent = status === "ready" && daysReadyFromProbe(probe) > 0;
  const generatingFlag = probe.generating === true;
  const updatedMs = row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
  const ageMin = Number.isNaN(updatedMs) ? Infinity : (nowMs - updatedMs) / 60_000;

  if (
    status === "generating" &&
    !workerAckedFromProbe(probe) &&
    nowMs - updatedMs >= WORKER_ACK_LIMIT_MS
  ) {
    return { status: "failed", hasContent: false, inProgress: false };
  }

  const planEmpty = status === "ready" && !hasContent;
  const stillInFlight =
    status === "generating" || (status === "ready" && generatingFlag) || planEmpty;

  if (!stillInFlight || ageMin < STALE_GENERATION_MIN) {
    return { status, hasContent, inProgress: status === "ready" && generatingFlag };
  }
  if (hasContent) return { status: "ready", hasContent: true, inProgress: false };
  return { status: "failed", hasContent: false, inProgress: false };
}

export interface ServedMealLite {
  /** The row the household is served (null = no plan rows at all). */
  served: MealRowLite | null;
  resolution: LiteResolution | null;
  masked: boolean;
  /** The newest row, when it is the masked failure. */
  maskedFailure: MealRowLite | null;
}

/**
 * getLatestPlan's choice on probe rows. `rows` = the household's meal_plans,
 * newest first; archived rows are skipped here so callers can pass every row.
 */
export function pickServedMealLite(rows: readonly MealRowLite[], nowMs: number): ServedMealLite {
  const window = rows.filter((r) => r.status !== "archived").slice(0, MEAL_SERVED_WINDOW);
  const newest = window[0];
  if (!newest) return { served: null, resolution: null, masked: false, maskedFailure: null };

  const resolved = resolveMealRowLite(newest, nowMs);
  if (resolved.status === "failed" && !resolved.hasContent) {
    for (const prev of window.slice(1)) {
      if (prev.status !== "ready") continue;
      // No probe = outside the window: a ready row is taken at its word.
      const prevHasContent = prev.probe ? daysReadyFromProbe(prev.probe) > 0 : true;
      if (!prevHasContent) continue;
      return {
        served: prev,
        resolution: { status: "ready", hasContent: true, inProgress: false },
        masked: true,
        maskedFailure: newest,
      };
    }
  }
  return { served: newest, resolution: resolved, masked: false, maskedFailure: null };
}

/**
 * The one mapping from a resolved row to the state every admin surface shows.
 * A 'ready' plan that is still filling in days (flagged generating), or a
 * 'ready' shell with no meals yet, is shown as generating — the household is
 * watching it being built.
 */
export function mealStateOf(r: {
  status: ResolvedStatus;
  inProgress: boolean;
  hasContent: boolean;
}): Exclude<PlanCellState, "none"> {
  if (r.status === "failed") return "failed";
  if (r.status === "generating" || r.inProgress || !r.hasContent) return "generating";
  return "ready";
}

/** The families list's meal column. */
export function mealCellFromRows(rows: readonly MealRowLite[], nowMs: number): MealPlanCell {
  const pick = pickServedMealLite(rows, nowMs);
  if (!pick.served || !pick.resolution) {
    return { state: "none", daysReady: null, daysTotal: DEFAULT_DAYS_TOTAL, masked: false };
  }
  const { resolution, served } = pick;
  return {
    state: mealStateOf(resolution),
    daysReady: served.probe ? daysReadyFromProbe(served.probe) : null,
    daysTotal: daysTotalFromProbe(served.probe),
    masked: pick.masked,
  };
}

// ── The served plan on full rows (one family) ───────────────────────────────

/** A meal_plans row with its blob — what getLatestPlan reads. */
export interface MealPlanRowFull {
  id: string;
  status: string;
  plan_data: unknown;
  generated_at: string | null;
  error_message: string | null;
  updated_at: string;
}

export interface ResolvedMealRow {
  id: string;
  status: ResolvedStatus;
  /** Validated plan (ready rows only), or null — exactly getLatestPlan's plan_data. */
  planData: MealPlan | null;
  inProgress: boolean;
  errorMessage: string | null;
  updatedAt: string;
  generatedAt: string | null;
}

/** getLatestPlan's per-row read. Null for an archived row. */
export function resolveMealRow(row: MealPlanRowFull, nowMs: number): ResolvedMealRow | null {
  const rawStatus = row.status as ResolvedStatus | "archived";
  if (rawStatus === "archived") return null;

  let validated: MealPlan | null = null;
  let finalStatus: ResolvedStatus = rawStatus;
  if (rawStatus === "ready") {
    const parsed = MealPlanSchema.safeParse(row.plan_data);
    if (parsed.success) validated = parsed.data;
    else finalStatus = "failed";
  }

  const resolved = resolveStaleness({
    status: finalStatus,
    planData: validated,
    updatedAt: row.updated_at,
    errorMessage: row.error_message ?? null,
    workerAcked: workerAckedFromPlanData(row.plan_data),
    now: nowMs,
  });
  return {
    id: row.id,
    status: resolved.status,
    planData: resolved.planData,
    inProgress: resolved.inProgress,
    errorMessage: resolved.errorMessage,
    updatedAt: row.updated_at,
    generatedAt: row.generated_at,
  };
}

/** The newest run died with nothing to show — getLatestPlan looks further back. */
export function needsPreviousPlan(resolved: ResolvedMealRow): boolean {
  return resolved.status === "failed" && !resolved.planData;
}

export interface ServedMealPick {
  served: ResolvedMealRow;
  masked: boolean;
  /** The failed newest row, when an older plan is served in its place. */
  maskedFailure: { id: string; errorMessage: string | null } | null;
}

/**
 * getLatestPlan's fallback loop. `newest` is the resolved newest row; `older`
 * the rest of the window, newest first (their plan_data is needed only for
 * 'ready' rows — the loop skips everything else).
 */
export function pickServedMealPlan(
  newest: ResolvedMealRow,
  older: readonly MealPlanRowFull[],
  nowMs: number,
): ServedMealPick {
  if (needsPreviousPlan(newest)) {
    for (const prev of older.slice(0, MEAL_SERVED_WINDOW - 1)) {
      if (prev.status !== "ready") continue;
      const parsed = MealPlanSchema.safeParse(prev.plan_data);
      if (!parsed.success || !planHasContent(parsed.data)) continue;
      const prevResolved = resolveStaleness({
        status: "ready",
        planData: parsed.data,
        updatedAt: prev.updated_at,
        errorMessage: null,
        workerAcked: workerAckedFromPlanData(prev.plan_data),
        now: nowMs,
      });
      if (!prevResolved.planData) continue;
      return {
        served: {
          id: prev.id,
          status: prevResolved.status,
          planData: prevResolved.planData,
          inProgress: prevResolved.inProgress,
          errorMessage: prevResolved.errorMessage,
          updatedAt: prev.updated_at,
          generatedAt: prev.generated_at,
        },
        masked: true,
        maskedFailure: { id: newest.id, errorMessage: newest.errorMessage },
      };
    }
  }
  return { served: newest, masked: false, maskedFailure: null };
}

// ── Projection ──────────────────────────────────────────────────────────────

export interface ProjectMealWeekOptions {
  /** Override plan_data.generating (the resolved state knows better on a dead run). */
  generating?: boolean;
  /** Current names by member id ("mom" | family_members.id) — the plan keeps the name it was generated with. */
  nameById?: ReadonlyMap<string, string>;
}

/**
 * plan_data → a compact week for display. Deliberately lenient (it also reads
 * the partial snapshots a live run writes, which the strict schema may reject):
 * anything malformed is skipped, never thrown. Returns null when there is no
 * plan object at all.
 *
 * - A day exists for a member only when it has at least one meal; the empty
 *   shells the engine writes for days still to come are dropped, so the UI can
 *   mark them missing.
 * - A child (is_child, stamped by the engine) is planned by PORTIONS: the
 *   calorie/protein figures on its header are an approximate average, not a
 *   target the days are held to, so both targets are null here.
 * - `sharedBy` is the number of people on the dish's per-member portions when
 *   the meal is a shared recipe, else 1.
 */
export function projectMealWeek(
  planData: unknown,
  opts: ProjectMealWeekOptions = {},
): MealWeekProjection | null {
  const pd = asRecord(planData);
  if (!pd) return null;

  const members: MealWeekMember[] = [];
  for (const raw of Array.isArray(pd.members) ? pd.members : []) {
    const m = asRecord(raw);
    if (!m) continue;
    const memberId = typeof m.member_id === "string" ? m.member_id : null;
    if (!memberId) continue;
    const isChild = m.is_child === true;
    const macros = asRecord(m.macros_target);
    members.push({
      memberId,
      name:
        opts.nameById?.get(memberId) ??
        (typeof m.member_name_ar === "string" && m.member_name_ar ? m.member_name_ar : memberId),
      isChild,
      caloriesTarget: isChild ? null : finiteNumber(m.daily_calories_target),
      proteinTargetG: isChild ? null : finiteNumber(macros?.protein_g),
      days: projectDays(m.days),
    });
  }

  const completeDays: number[] = [];
  if (members.length > 0) {
    for (let d = 0; d < 7; d += 1) {
      if (members.every((m) => m.days.some((day) => day.dayIndex === d))) completeDays.push(d);
    }
  }

  return {
    weekStartDate: typeof pd.week_start_date === "string" ? pd.week_start_date : null,
    daysTotal: positiveInt(pd.days_total) ?? DEFAULT_DAYS_TOTAL,
    generating: opts.generating ?? pd.generating === true,
    members,
    completeDays,
  };
}

function projectDays(rawDays: unknown): MealWeekDay[] {
  const byIndex = new Map<number, MealWeekDay>();
  for (const raw of Array.isArray(rawDays) ? rawDays : []) {
    const day = asRecord(raw);
    if (!day) continue;
    const dayIndex = day.day_index;
    if (typeof dayIndex !== "number" || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6)
      continue;
    const meals = projectMeals(day.meals);
    if (meals.length === 0 || byIndex.has(dayIndex)) continue;
    const total = asRecord(day.day_total);
    byIndex.set(dayIndex, {
      dayIndex,
      meals,
      totalCalories: positiveOrNull(total?.calories) ?? sumOrNull(meals.map((x) => x.calories)),
      totalProteinG: positiveOrNull(total?.protein_g) ?? sumOrNull(meals.map((x) => x.proteinG)),
    });
  }
  return [...byIndex.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}

function projectMeals(rawMeals: unknown): MealWeekMeal[] {
  const out: MealWeekMeal[] = [];
  for (const raw of Array.isArray(rawMeals) ? rawMeals : []) {
    const meal = asRecord(raw);
    if (!meal) continue;
    const name = typeof meal.recipe_name_ar === "string" ? meal.recipe_name_ar.trim() : "";
    if (!name) continue;
    const portions = Array.isArray(meal.per_member_portions) ? meal.per_member_portions : [];
    const sharers = new Set<string>();
    for (const p of portions) {
      const id = asRecord(p)?.member_id;
      if (typeof id === "string" && id) sharers.add(id);
    }
    out.push({
      slot: typeof meal.slot === "string" ? meal.slot : "",
      name,
      calories: finiteNumber(meal.calories),
      proteinG: finiteNumber(asRecord(meal.macros)?.protein_g),
      sharedBy: meal.shared_recipe === true && sharers.size > 1 ? sharers.size : 1,
    });
  }
  return out;
}

export interface MemberPlanTargets {
  primaryGoal: string | null;
  caloriesTarget: number | null;
  macros: { protein_g: number; carbs_g: number; fat_g: number } | null;
}

/**
 * Per-member goal and targets as the plan states them (the household table's
 * goal/calories/macros). Lenient like `projectMealWeek`; children keep the
 * engine's approximate figures here, exactly as the old detail page showed.
 */
export function planTargetsById(planData: unknown): Map<string, MemberPlanTargets> {
  const out = new Map<string, MemberPlanTargets>();
  const pd = asRecord(planData);
  for (const raw of pd && Array.isArray(pd.members) ? pd.members : []) {
    const m = asRecord(raw);
    const id = m && typeof m.member_id === "string" ? m.member_id : null;
    if (!m || !id || out.has(id)) continue;
    const mac = asRecord(m.macros_target);
    const protein = finiteNumber(mac?.protein_g);
    const carbs = finiteNumber(mac?.carbs_g);
    const fat = finiteNumber(mac?.fat_g);
    out.set(id, {
      primaryGoal: typeof m.primary_goal === "string" && m.primary_goal ? m.primary_goal : null,
      caloriesTarget: finiteNumber(m.daily_calories_target),
      macros:
        protein !== null && carbs !== null && fat !== null
          ? { protein_g: protein, carbs_g: carbs, fat_g: fat }
          : null,
    });
  }
  return out;
}

// ── small, defensive readers ────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** A finite number, accepting numeric strings (Postgres numeric can arrive as one). */
export function finiteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function positiveInt(v: unknown): number | null {
  const n = finiteNumber(v);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function positiveOrNull(v: unknown): number | null {
  const n = finiteNumber(v);
  return n !== null && n > 0 ? n : null;
}

function sumOrNull(values: Array<number | null>): number | null {
  let seen = false;
  let total = 0;
  for (const v of values) {
    if (v === null) continue;
    seen = true;
    total += v;
  }
  return seen ? Math.round(total) : null;
}
