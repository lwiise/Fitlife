import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKELETON_MODEL,
  DAY_MODEL,
  TRANSLATE_MODEL,
  planModelLabel,
  MAX_OUTPUT_TOKENS,
  DAY_MAX_TOKENS,
  skeletonMaxTokens,
  dayMaxTokens,
  bigCallTimeoutMs,
  dayConcurrency,
  MEMBER_GEN_MAX_ATTEMPTS,
} from "./constants";
import { z } from "zod";
import { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
import {
  STATIC_SYSTEM,
  buildSkeletonPrompt,
  buildDayPrompt,
  buildTranslatePrompt,
  buildNameTranslatePrompt,
} from "./systemPrompt";
import {
  MealPlanSchema,
  PlanSkeletonSchema,
  DaySliceSchema,
  LOCALE_CODES,
  type MealPlan,
  type MemberPlan,
  type PlanSkeleton,
  type Meal,
  type Day,
  type Ingredient,
  type PerMemberPortion,
  type LocaleCode,
} from "./schema";
import {
  PlanValidationError,
  AnthropicCallError,
  GenerationInFlightError,
} from "./errors";
import {
  getBeneficiaries,
  type PlanPromptContext,
  type PlanPromptContextMember,
} from "./buildContext";
import { riyadhTodayISO, khaleejiDayName } from "./dates";

// Accepts any Supabase client shape (cookie-typed or service-role admin).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export interface GenerateResult {
  plan: MealPlan;
  mealPlanId: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    duration_ms: number;
  };
}

// Static slot → Arabic label. The day prompt no longer asks the model to echo
// slot_name_ar (a per-meal token cost for a value derivable from `slot`); we fill
// it here. Both snacks collapse to "سناك" — the morning/evening snack nuance the
// skeleton might carry is not worth re-emitting on every meal.
const SLOT_NAME_AR: Record<string, string> = {
  breakfast: "الفطور",
  lunch: "الغداء",
  dinner: "العشاء",
  snack: "سناك",
};

/**
 * Expand a TERSE-keyed day slice (the compact JSON the day prompt asks for, to cut
 * output tokens) into the canonical DaySlice shape that DaySliceSchema and the rest
 * of the engine expect, and fill slot_name_ar from slot. Tolerant of canonical keys
 * too (`n ?? name_ar` etc.), so a meal the model emits in full-key form still parses.
 * Pure and total: returns a fresh object; malformed input falls through unchanged to
 * zod validation (which yields the existing "failed validation" error). `??` (not
 * `||`) so a legitimate 0 amount/calorie is preserved.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expandTerseDaySlice(raw: unknown): any {
  if (raw == null || typeof raw !== "object") return raw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as Record<string, any>;
  const members = r.ms ?? r.members;
  if (!Array.isArray(members)) return raw;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandIngredient = (g: any) => {
    if (g == null || typeof g !== "object") return g;
    const out: Record<string, unknown> = {
      name_ar: g.n ?? g.name_ar,
      amount: g.a ?? g.amount,
      unit: g.u ?? g.unit,
    };
    const mn = g.mn ?? g.amount_min;
    const mx = g.mx ?? g.amount_max;
    if (mn != null) out.amount_min = mn;
    if (mx != null) out.amount_max = mx;
    return out;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandMeal = (m: any) => {
    if (m == null || typeof m !== "object") return m;
    const slot = m.s ?? m.slot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mc = (m.mc ?? m.macros ?? {}) as Record<string, any>;
    const out: Record<string, unknown> = {
      slot,
      slot_name_ar:
        m.slot_name_ar ??
        (typeof slot === "string" ? SLOT_NAME_AR[slot] : undefined) ??
        slot,
      recipe_name_ar: m.r ?? m.recipe_name_ar,
      ingredients: (m.ig ?? m.ingredients ?? []).map(expandIngredient),
      prep_steps_ar: m.st ?? m.prep_steps_ar ?? [],
      calories: m.c ?? m.calories,
      macros: {
        protein_g: mc.p ?? mc.protein_g,
        carbs_g: mc.cb ?? mc.carbs_g,
        fat_g: mc.f ?? mc.fat_g,
      },
    };
    const sub = m.sub ?? m.substitutions_ar;
    if (sub != null) out.substitutions_ar = sub;
    const nt = m.nt ?? m.notes_ar;
    if (nt != null) out.notes_ar = nt;
    return out;
  };

  return {
    day_index: r.d ?? r.day_index,
    ...(r.day_name_ar != null ? { day_name_ar: r.day_name_ar } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members: members.map((sm: any) => ({
      member_id: sm.id ?? sm.member_id,
      meals: (sm.m ?? sm.meals ?? []).map(expandMeal),
    })),
  };
}

/**
 * Synchronously insert the placeholder rows so the polling UI has something to
 * watch. Fast (<1s). Returns the new meal_plan id.
 */
export async function createPlanRows(
  supabase: AnyClient,
  userId: string,
): Promise<string> {
  const mealPlanId = crypto.randomUUID();

  const { error: insertMealError } = await supabase.from("meal_plans").insert({
    id: mealPlanId,
    user_id: userId,
    status: "generating",
    plan_data: {},
    ai_model: planModelLabel(),
  });
  if (insertMealError) {
    throw new Error(`Failed to create meal_plan row: ${insertMealError.message}`);
  }

  const { error: insertGenError } = await supabase
    .from("plan_generations")
    .insert({
      user_id: userId,
      meal_plan_id: mealPlanId,
      model: planModelLabel(),
      status: "started",
      started_at: new Date().toISOString(),
    });
  if (insertGenError) {
    // 23505 = the partial unique index from migration 00012: another 'started'
    // row already exists for this user, i.e. we lost a dispatch race. Archive
    // (NOT fail) our placeholder — a 'failed' row would become the user's
    // latest plan and flash the failure UI over the healthy in-flight run,
    // and DELETE has no RLS policy for the user-scoped client.
    if ((insertGenError as { code?: string }).code === "23505") {
      const { error: archiveError } = await supabase
        .from("meal_plans")
        .update({
          status: "archived",
          error_message: "superseded: another generation was already in flight",
        })
        .eq("id", mealPlanId);
      if (archiveError) {
        // Rare double-failure: the orphan 'generating' row is reclassified by
        // the reader's 15-min staleness guard; nothing more to do here.
        console.error(
          "[createPlanRows] failed to archive raced placeholder",
          archiveError.message,
        );
      }
      throw new GenerationInFlightError();
    }
    await supabase
      .from("meal_plans")
      .update({ status: "failed", error_message: "audit row insert failed" })
      .eq("id", mealPlanId);
    throw new Error(
      `Failed to create plan_generations row: ${insertGenError.message}`,
    );
  }

  return mealPlanId;
}

/** Run an async fn over items with a concurrency cap (no deps). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

/**
 * A retryable Anthropic error: 429 (rate limit), 529 (overloaded), any 5xx, or a
 * transient stream error. 529 is matched both explicitly and via the 5xx branch.
 */
export function isRetryable(err: unknown): boolean {
  return (
    err instanceof AnthropicCallError &&
    (/Anthropic API (429|529|5\d\d)/.test(err.message) ||
      /overloaded/i.test(err.message) ||
      /stream error/.test(err.message) ||
      /timeout/i.test(err.message))
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff with full jitter. attempt is 1-based (first retry = 1).
export const MAX_RETRIES = 5;

/**
 * How long to wait before a day-call retry. Honors the server's Retry-After
 * (rate-limit window) when present; otherwise exponential backoff with jitter,
 * capped at 30s so a transient 429/529 burst gets a real chance to clear within
 * the function budget. Exported for unit testing.
 */
export function retryWaitMs(attempt: number, retryAfterMs?: number): number {
  const jitter = Math.floor(Math.random() * 400);
  if (retryAfterMs != null) return Math.min(60_000, retryAfterMs) + jitter;
  return Math.min(30_000, 800 * 2 ** (attempt - 1)) + jitter;
}

/**
 * The representative cause for an all-days-failed throw: the most frequent per-day
 * error message (ties → earliest seen), truncated. Surfaces the true reason
 * (e.g. "Anthropic API 429: rate_limit_error…" or "Day N failed validation: …")
 * into meal_plans.error_message / the UI technical details / Sentry instead of a count.
 * Exported for unit testing.
 */
export function summarizeDayErrors(errors: string[]): string {
  if (errors.length === 0) return "";
  const counts = new Map<string, number>();
  for (const e of errors) counts.set(e, (counts.get(e) ?? 0) + 1);
  let best = "";
  let bestN = 0;
  for (const [msg, n] of counts)
    if (n > bestN) {
      best = msg;
      bestN = n;
    }
  return best.slice(0, 300);
}

// A single day re-rolls this many times on a transient CONTENT failure before
// giving up (separate from MAX_RETRIES, which governs API-transient retries).
const CONTENT_MAX_RETRIES = 2;

/**
 * A one-off bad model RESPONSE that a fresh re-roll typically fixes: malformed
 * JSON (native SyntaxError from JSON.parse) or a DaySliceSchema validation miss
 * (PlanValidationError "… failed validation …"). Model sampling varies between
 * calls, so re-asking the same prompt usually parses — this is exactly what the
 * manual "regenerate this day" button does. Deliberately NOT max_tokens (handled
 * by the doubled-cap retry) and NOT logic errors like a resync TypeError (those
 * are deterministic — fail fast so they surface). Exported for unit testing.
 */
export function isTransientContentError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  if (err instanceof PlanValidationError) return /failed validation/.test(err.message);
  return false;
}

function sumDayTotal(meals: Meal[]) {
  let calories = 0,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0;
  for (const m of meals) {
    calories += m.calories || 0;
    protein_g += m.macros.protein_g || 0;
    carbs_g += m.macros.carbs_g || 0;
    fat_g += m.macros.fat_g || 0;
  }
  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
  };
}

// ── Deterministic shared-meal assembly + re-sync ────────────────────────────
// The model returns each member's OWN single-portion recipe for a dish. We do NOT
// trust it to sum a batch or compute the split — both are derived here in code, so
// shared meals are always correct (totals = sum of portions, % = each portion's
// weight share). Members who emit the SAME dish (same normalized recipe_name_ar in
// the same slot) form a shared group; everyone else stays individual. Grouping on
// the EMITTED name (not a forced skeleton name) is what lets a member whose profile
// needs a different dish break out: the model gives them a differently-named dish
// and they're left individual — "share only when it actually fits".
//
// Each participant's own single portion is retained on the shared meal (own_portion)
// so the batch can be RE-DERIVED when one member is later edited, WITHOUT touching
// the others' recipes — only the batch totals/split and group membership update.

const GRAMS_PER_UNIT: Partial<Record<Ingredient["unit"], number>> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
};

/** Approximate edible weight of one portion from its weighable ingredients. */
function portionWeightG(ings: Ingredient[]): number {
  let g = 0;
  for (const ing of ings) {
    const factor = GRAMS_PER_UNIT[ing.unit];
    if (factor != null) g += ing.amount * factor;
  }
  return g;
}

/** Sum per-person ingredient lists into one batch (matched by Arabic name + unit). */
function sumIngredients(lists: Ingredient[][]): Ingredient[] {
  const byKey = new Map<string, Ingredient>();
  const order: string[] = [];
  for (const list of lists) {
    for (const ing of list) {
      const key = `${ing.name_ar.trim()}|${ing.unit}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...ing });
        order.push(key);
      } else {
        existing.amount = Math.round((existing.amount + ing.amount) * 10) / 10;
        if (existing.amount_min != null && ing.amount_min != null)
          existing.amount_min =
            Math.round((existing.amount_min + ing.amount_min) * 10) / 10;
        if (existing.amount_max != null && ing.amount_max != null)
          existing.amount_max =
            Math.round((existing.amount_max + ing.amount_max) * 10) / 10;
      }
    }
  }
  return order.map((k) => byKey.get(k)!);
}

/**
 * Canonicalize an Arabic dish name for GROUPING ONLY (the displayed name stays the
 * original). The skeleton model is asked to reuse the same recipe_name_ar for members
 * who share a dish, but it does not emit byte-identical Arabic — cosmetic variation
 * (leading "ال", alef/ya/ta-marbuta forms, harakat, tatweel, zero-width/bidi marks,
 * whitespace) would otherwise split one shared dish into per-member singletons. Folding
 * those here makes the merge robust without affecting what the user sees. Conservative:
 * it only erases orthography, never lexical content, so genuinely different dishes (with
 * different consonant skeletons) never collide.
 */
export function normalizeDishKey(name: string): string {
  let s = name
    .normalize("NFC")
    // strip diacritics (Mn: harakat, superscript alef, madda/hamza), zero-width/bidi
    // format chars (Cf), and tatweel (Lm) — none distinguish two real dishes.
    .replace(/[\p{Mn}\p{Cf}\p{Lm}]/gu, "")
    // alef variants (0623/0625/0622/0671) -> bare alef (0627)
    .replace(/[أإآٱ]/g, "ا")
    // alef-maqsura (0649) -> ya (064A)
    .replace(/ى/g, "ي")
    // ta-marbuta (0629) -> ha (0647)
    .replace(/ة/g, "ه")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
  // Strip a single LEADING definite article (alef+lam = "ال"), keeping a
  // meaningful stem (>=3 chars). Leading-only (not per-word) to bound over-merge risk.
  if (s.startsWith("ال") && s.length - 2 >= 3) s = s.slice(2);
  return s;
}

/** Every beneficiary's meals for ONE day, fed to resyncSharedMeals. */
export interface MemberDayMeals {
  member_id: string;
  meals: Meal[];
  // True if these meals were just (re)generated this run (raw single portions);
  // false for members carried over verbatim from the prior plan.
  fresh: boolean;
}

/**
 * Strip a meal down to an individual recipe (no shared/batch fields). When the meal
 * carries an own_portion (it was a shared participant), restore that single portion
 * as the recipe; otherwise it is already its own portion and is returned unchanged
 * (same reference — keeps a carried individual meal byte-identical). Batch
 * translations are dropped on dissolution so the housekeeper pass re-translates the
 * now-individual recipe.
 */
function toIndividualMeal(meal: Meal): Meal {
  const own = meal.own_portion;
  const hadShared =
    meal.shared_recipe === true ||
    meal.batch_finished_weight_g != null ||
    meal.per_member_portions != null ||
    own != null;
  if (!hadShared) return meal;
  const out: Meal = {
    ...meal,
    recipe_name_ar: own?.recipe_name_ar ?? meal.recipe_name_ar,
    ingredients: own ? own.ingredients.map((i) => ({ ...i })) : meal.ingredients,
    prep_steps_ar: own ? [...own.prep_steps_ar] : meal.prep_steps_ar,
  };
  delete out.shared_recipe;
  delete out.batch_finished_weight_g;
  delete out.per_member_portions;
  delete out.own_portion;
  delete out.ingredients_translated;
  delete out.recipe_name_translated;
  delete out.prep_steps_translated;
  delete out.prep_steps_translated_locale;
  return out;
}

/**
 * This member's OWN single portion as a standalone individual meal — the input to
 * (re)assembly for a CARRIED meal. Individual carried meals are their own portion;
 * shared carried meals carry it in own_portion. Legacy carried shared meals (made
 * before own_portion existed) are approximated by scaling the batch by the member's
 * share — only hit once, on the first re-sync of an old plan; correct thereafter.
 */
function ownPortionMeal(meal: Meal, memberId: string): Meal {
  if (meal.shared_recipe !== true || meal.own_portion) return toIndividualMeal(meal);
  const p = (meal.per_member_portions ?? []).find((pp) => pp.member_id === memberId);
  const n = meal.per_member_portions?.length || 1;
  const frac = p?.portion_percentage != null ? p.portion_percentage / 100 : 1 / n;
  const scale = (v: number) => Math.round(v * frac * 10) / 10;
  const out: Meal = {
    ...meal,
    ingredients: meal.ingredients.map((i) => ({
      ...i,
      amount: scale(i.amount),
      ...(i.amount_min != null ? { amount_min: scale(i.amount_min) } : {}),
      ...(i.amount_max != null ? { amount_max: scale(i.amount_max) } : {}),
    })),
  };
  delete out.shared_recipe;
  delete out.batch_finished_weight_g;
  delete out.per_member_portions;
  delete out.own_portion;
  delete out.ingredients_translated;
  delete out.recipe_name_translated;
  delete out.prep_steps_translated;
  delete out.prep_steps_translated_locale;
  return out;
}

/**
 * Build one shared batch from a group of ≥2 OWN-portion meals: summed ingredients,
 * the weight/calorie split, and the largest portion as the canonical recipe text.
 * Each member keeps its own calories/macros and stores its own_portion for the next
 * re-sync. Returns the assembled shared meal per entry (input order).
 */
function buildSharedGroup(
  entries: { member_id: string; meal: Meal }[],
): Meal[] {
  const batch = sumIngredients(entries.map((e) => e.meal.ingredients));
  const weights = entries.map((e) => ({
    id: e.member_id,
    g: portionWeightG(e.meal.ingredients),
    cal: e.meal.calories || 0,
  }));
  const totalG = weights.reduce((s, w) => s + w.g, 0);
  const totalCal = weights.reduce((s, w) => s + w.cal, 0);

  let portions: PerMemberPortion[];
  let batchWeight: number | undefined;
  if (totalG > 0) {
    batchWeight = Math.round(totalG);
    portions = weights.map((w) => ({
      member_id: w.id,
      portion_grams: Math.round(w.g),
      portion_percentage: Math.round((w.g / totalG) * 100),
    }));
  } else if (totalCal > 0) {
    // No weighable ingredients (e.g. pieces/cups only) → split by calorie share.
    portions = weights.map((w) => ({
      member_id: w.id,
      portion_percentage: Math.round((w.cal / totalCal) * 100),
    }));
  } else {
    const pct = Math.round(100 / entries.length);
    portions = weights.map((w) => ({ member_id: w.id, portion_percentage: pct }));
  }

  // Canonical recipe text = the largest portion (most complete ingredient list).
  const canonical = entries.reduce((a, b) =>
    portionWeightG(b.meal.ingredients) >= portionWeightG(a.meal.ingredients) ? b : a,
  ).meal;

  // Rebuild translated batch ingredients from canonical's name map (when the
  // canonical own portion carries translations). Recomputed groups usually start
  // untranslated — the housekeeper pass fills the gaps after generation.
  let batchTranslated: Ingredient[] | undefined;
  if (
    canonical.ingredients_translated &&
    canonical.ingredients_translated.length === canonical.ingredients.length
  ) {
    const transByName = new Map<string, Ingredient>();
    canonical.ingredients.forEach((ing, i) =>
      transByName.set(ing.name_ar.trim(), canonical.ingredients_translated![i]!),
    );
    batchTranslated = batch.map((ing) => {
      const t = transByName.get(ing.name_ar.trim());
      return t
        ? {
            ...t,
            amount: ing.amount,
            amount_min: ing.amount_min,
            amount_max: ing.amount_max,
            unit: ing.unit,
          }
        : { ...ing };
    });
  }

  return entries.map((e) => {
    const out: Meal = {
      ...e.meal,
      // One shared dish reads with ONE slot + label for everyone who shares it
      // (the model may emit e.g. "سناك الصباح" for one member, "سناك المساء" for
      // another). slot already matches (grouping keys on it); canonicalize the
      // display label too. Order across members is enforced separately at render.
      slot: canonical.slot,
      slot_name_ar: canonical.slot_name_ar,
      recipe_name_ar: canonical.recipe_name_ar,
      ingredients: batch.map((i) => ({ ...i })),
      prep_steps_ar: [...canonical.prep_steps_ar],
      shared_recipe: true,
      per_member_portions: portions.map((p) => ({ ...p })),
      // Retain this member's own single portion so the batch can be re-derived
      // when ONE member is later edited, without regenerating the others.
      own_portion: {
        recipe_name_ar: e.meal.recipe_name_ar,
        ingredients: e.meal.ingredients.map((i) => ({ ...i })),
        prep_steps_ar: [...e.meal.prep_steps_ar],
      },
      // Each member keeps their OWN calories/macros (already on ...e.meal).
    };
    if (batchWeight != null) out.batch_finished_weight_g = batchWeight;
    else delete out.batch_finished_weight_g;
    if (canonical.recipe_name_translated)
      out.recipe_name_translated = canonical.recipe_name_translated;
    else delete out.recipe_name_translated;
    if (canonical.prep_steps_translated)
      out.prep_steps_translated = [...canonical.prep_steps_translated];
    else delete out.prep_steps_translated;
    if (canonical.prep_steps_translated_locale)
      out.prep_steps_translated_locale = canonical.prep_steps_translated_locale;
    else delete out.prep_steps_translated_locale;
    if (batchTranslated)
      out.ingredients_translated = batchTranslated.map((i) => ({ ...i }));
    else delete out.ingredients_translated;
    return out;
  });
}

/**
 * Re-derive ONE day's shared meals across the WHOLE family, deterministically.
 *
 * `members` carries every beneficiary's meals for that day. `fresh` members were
 * just (re)generated (raw single portions); the rest are carried over (possibly
 * already-assembled) and kept VERBATIM unless a fresh member joins or leaves one of
 * their shared dishes — so editing one member updates exactly the shared meals they
 * touch, and nothing else.
 *
 * Grouping keys on the EMITTED dish name (normalized), so a member whose profile
 * needs a different dish simply gets a differently-named dish and is left individual.
 * Returns the assembled meals per member (input order); unchanged carried meals are
 * returned by reference so carry-over stays byte-identical. Exported for testing.
 */
export function resyncSharedMeals(
  members: MemberDayMeals[],
  independentIds?: ReadonlySet<string>,
): Map<string, Meal[]> {
  const freshSet = new Set(members.filter((m) => m.fresh).map((m) => m.member_id));
  // An independent beneficiary (incl. the mom) never shares a dish, even when its
  // emitted name collides with the family's. meal_mode is the STRUCTURAL guarantee
  // here; the prompt only *asks* the model for distinct names. Without this, the
  // dish-name grouping below silently re-merged an independent member into a shared
  // batch — the "switched mom to independent but the plan is still shared" bug.
  const isIndependent = (id: string) => independentIds?.has(id) ?? false;

  type Entry = { member_id: string; meal: Meal; fresh: boolean };
  const groups = new Map<string, Entry[]>();
  const order: string[] = [];
  for (const m of members) {
    for (const meal of m.meals) {
      const key = `${meal.slot}|${normalizeDishKey(meal.recipe_name_ar)}`;
      let arr = groups.get(key);
      if (!arr) {
        arr = [];
        groups.set(key, arr);
        order.push(key);
      }
      arr.push({ member_id: m.member_id, meal, fresh: m.fresh });
    }
  }

  const resolved = new Map<Meal, Meal>(); // input meal → assembled meal
  for (const key of order) {
    const entries = groups.get(key)!;
    // A group needs recompute when a fresh member is in it, OR a carried member in
    // it previously shared with a member that's fresh this run (so a fresh member
    // that LEFT this dish is dropped from the remaining batch), OR an independent
    // member must be peeled out of a name-colliding share. Otherwise it's untouched
    // by this run and every carried meal is kept exactly as-is.
    const hasIndependent = entries.some((e) => isIndependent(e.member_id));
    const hasFresh = entries.some((e) => e.fresh);
    const referencesFresh =
      !hasFresh &&
      entries.some(
        (e) =>
          e.meal.shared_recipe === true &&
          (e.meal.per_member_portions ?? []).some((p) => freshSet.has(p.member_id)),
      );
    if (!hasFresh && !referencesFresh && !hasIndependent) {
      for (const e of entries) resolved.set(e.meal, e.meal);
      continue;
    }
    // Independent members are always individual; only the shared members can batch.
    const sharedEntries: Entry[] = [];
    for (const e of entries) {
      if (isIndependent(e.member_id)) resolved.set(e.meal, toIndividualMeal(e.meal));
      else sharedEntries.push(e);
    }
    if (sharedEntries.length === 0) continue;
    const own = sharedEntries.map((e) => ({
      member_id: e.member_id,
      meal: e.fresh ? toIndividualMeal(e.meal) : ownPortionMeal(e.meal, e.member_id),
    }));
    if (own.length < 2) {
      // Eaten by one person now → individual (dissolves a former share).
      resolved.set(sharedEntries[0]!.meal, own[0]!.meal);
      continue;
    }
    const built = buildSharedGroup(own);
    built.forEach((b, i) => resolved.set(sharedEntries[i]!.meal, b));
  }

  const out = new Map<string, Meal[]>();
  for (const m of members)
    out.set(
      m.member_id,
      m.meals.map((meal) => resolved.get(meal)!),
    );
  return out;
}

/**
 * Resolve a literal partial-regenerate scope against the prior plan: which
 * members are affected and, per (member, day), which of that day's ORIGINAL meals
 * (in stored order) are in-scope (to regenerate). Out-of-scope meals are kept.
 *
 *  - 'individual' → only the target; in-scope = its non-shared meals.
 *  - 'shared'     → target + every co-sharer of a dish the TARGET shares; in-scope
 *                   for each = the slots of those target-shared dishes.
 *  - 'both'       → target (ALL meals in-scope) + co-sharers (target-shared slots).
 */
function resolvePartialScope(
  existingPlan: MealPlan,
  targetId: string,
  scope: "individual" | "shared" | "both",
): { affectedIds: Set<string>; inScopeByMemberDay: Map<string, Map<number, boolean[]>> } {
  const affectedIds = new Set<string>([targetId]);
  const inScopeByMemberDay = new Map<string, Map<number, boolean[]>>();
  const target = existingPlan.members.find((m) => m.member_id === targetId);
  if (!target) return { affectedIds, inScopeByMemberDay };

  if (scope === "individual") {
    const dm = new Map<number, boolean[]>();
    for (const d of target.days)
      dm.set(
        d.day_index,
        d.meals.map((m) => m.shared_recipe !== true),
      );
    inScopeByMemberDay.set(targetId, dm);
    return { affectedIds, inScopeByMemberDay };
  }

  // 'shared' / 'both': find the target's shared dishes per day + their co-sharers.
  const sharedKeysByDay = new Map<number, Set<string>>();
  const targetDm = new Map<number, boolean[]>();
  for (const d of target.days) {
    const keys = new Set<string>();
    for (const m of d.meals) {
      if (m.shared_recipe === true) {
        keys.add(`${m.slot}|${normalizeDishKey(m.recipe_name_ar)}`);
        for (const p of m.per_member_portions ?? []) affectedIds.add(p.member_id);
      }
    }
    sharedKeysByDay.set(d.day_index, keys);
    targetDm.set(
      d.day_index,
      // 'both' → every meal; 'shared' → only the shared ones.
      d.meals.map((m) => (scope === "both" ? true : m.shared_recipe === true)),
    );
  }
  inScopeByMemberDay.set(targetId, targetDm);

  for (const m of existingPlan.members) {
    if (m.member_id === targetId || !affectedIds.has(m.member_id)) continue;
    const dm = new Map<number, boolean[]>();
    for (const d of m.days) {
      const keys = sharedKeysByDay.get(d.day_index) ?? new Set<string>();
      dm.set(
        d.day_index,
        d.meals.map(
          (mm) =>
            mm.shared_recipe === true &&
            keys.has(`${mm.slot}|${normalizeDishKey(mm.recipe_name_ar)}`),
        ),
      );
    }
    inScopeByMemberDay.set(m.member_id, dm);
  }
  return { affectedIds, inScopeByMemberDay };
}

/**
 * Pull freshly-generated meals to fill the in-scope positions of `frame`,
 * matched by slot type in frame order. Returns one entry per frame meal: a fresh
 * single-portion meal for an in-scope position that found a same-slot fresh meal,
 * else null (out-of-scope, or no fresh meal of that slot — caller keeps original).
 */
function extractInScopeFresh(
  frame: Meal[],
  inScope: boolean[],
  fresh: Meal[],
): (Meal | null)[] {
  const bySlot = new Map<string, Meal[]>();
  for (const m of fresh) {
    const arr = bySlot.get(m.slot);
    if (arr) arr.push(m);
    else bySlot.set(m.slot, [m]);
  }
  return frame.map((m, i) => {
    if (!inScope[i]) return null;
    const arr = bySlot.get(m.slot);
    return arr && arr.length ? arr.shift()! : null;
  });
}

/**
 * Prepare a carried-over plan + context for a SHARED-GROUP regen — used when a new
 * SHARED member is added. Every shared beneficiary (mom if shared + each shared
 * family member, including the newcomer) is rebuilt TOGETHER as one coherent menu
 * that streams in day-by-day side by side; independent members and the housekeeper
 * are carried verbatim. Each shared member's MEALS are emptied while the day shells
 * are kept (so the week grid survives even when the WHOLE family is shared — that
 * grid is what lets the plan open in place and stream day-by-day rather than falling
 * back to a full-screen "generating" state). Emptied meals make the engine treat
 * those members as incomplete (the family dish grid is seeded only from shared
 * members' MEALED days, so an empty-meal grid → a fresh, genuinely-shared menu for
 * the whole group). Returns the cleared plan + the context member list restricted to
 * this run: shared members
 * regenerate, already-in-plan independent members + the housekeeper are kept (carried),
 * and pending NON-shared members not yet in the plan are dropped so they still
 * generate later, one at a time. Pure — does not mutate its inputs.
 */
export function prepareSharedGroupRegen(
  context: PlanPromptContext,
  existingPlan: MealPlan,
): { existingPlan: MealPlan; familyMembers: PlanPromptContextMember[] } {
  const sharedIds = new Set<string>();
  if (context.mom.meal_mode === "shared") sharedIds.add("mom");
  for (const m of context.family_members)
    if (m.role !== "housekeeper" && m.meal_mode === "shared") sharedIds.add(m.id);

  const clearedPlan: MealPlan = {
    ...existingPlan,
    members: existingPlan.members.map((m) =>
      sharedIds.has(m.member_id)
        ? {
            ...m,
            // Keep the day shells (preserves week_grid / day-by-day loading), drop
            // the meals so the engine regenerates this member.
            days: m.days.map((d) => ({
              ...d,
              meals: [],
              day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            })),
          }
        : m,
    ),
  };

  const inPlan = new Set(clearedPlan.members.map((m) => m.member_id));
  const familyMembers = context.family_members.filter(
    (m) => m.role === "housekeeper" || m.meal_mode === "shared" || inPlan.has(m.id),
  );
  return { existingPlan: clearedPlan, familyMembers };
}

/**
 * Generate the family plan day-by-day (sequential, all days shown as "loading").
 * INCREMENTAL: members already complete in `existingPlan` are carried over
 * verbatim; only new/incomplete members are generated, and they're aligned to
 * the family's existing dishes (same dish per day, that member's own portions).
 * No DB access — callers persist the result (progressively via `onProgress`).
 */
export async function generateMealPlan(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
  // Prior plan to carry completed members over from (family add/edit). When
  // omitted, everyone is generated fresh (manual "new plan").
  existingPlan?: MealPlan | null;
  // Per-member regenerate: the member(s) being generated get FRESH independent
  // dishes instead of being aligned to the family's existing dish grid. Used by
  // the per-member "new plan" button; left off for add/edit (which stay aligned).
  independentRegen?: boolean;
  // One-at-a-time member add/complete: generate ONLY this member's missing days,
  // carrying every other member verbatim (incl. any empty/failed days, which are
  // shelled but never re-touched). When omitted, every incomplete member is
  // generated (initial plan). Also stamped into plan_data.generating_member_id so
  // the UI scopes its loading spinners to the member actually being filled.
  onlyMemberId?: string;
  // Per-member edit/regenerate: the member whose regenerate button was clicked.
  // Unlike onlyMemberId (which also SCOPES which members generate), this is the
  // authoritative target for plan_data.generating_member_id — so the loading
  // screen names the clicked member even when other members are also incomplete
  // (tier-deferred / previously-failed), where inferring from membersToGenerate
  // would wrongly fall back to the account owner.
  regenerateMemberId?: string;
  // Literal partial regenerate (the regenerate-scope dialog). Regenerates only a
  // CATEGORY of regenerateMemberId's meals, preserving the rest byte-for-byte:
  //   'individual' → the member's own (non-shared) meals; affects only them.
  //   'shared'     → the dishes they share with others; co-sharers' copies of
  //                  those dishes regenerate too (one batch stays consistent).
  //   'both'       → the member's own meals AND their shared dishes (co-sharers
  //                  recompute on the shared ones).
  // Requires existingPlan + regenerateMemberId. Out-of-scope meals are kept exactly.
  regenScope?: "individual" | "shared" | "both";
  // Shared-group regenerate: the run rebuilds MULTIPLE members together (a member
  // switched back to Shared re-merges with the group), so don't pin
  // generating_member_id to regenerateMemberId — leave it unset so the UI shows them
  // all loading. regenerated_for (quota counting) still records regenerateMemberId.
  suppressTargetedMember?: boolean;
  // Called (serialized) after each day completes with the plan-so-far.
  onProgress?: (
    snapshot: MealPlan,
    info: { readyDays: number; totalDays: number },
  ) => Promise<void> | void;
}): Promise<{
  plan: MealPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  // Day indices that were expected but dropped after retries (partial plan).
  missingDays: number[];
  // Representative reason the dropped days failed (e.g. "Day 3 failed validation: …"),
  // so a PARTIAL failure is diagnosable in error_message — not just which days. "" if none.
  missingDaysCause?: string;
}> {
  const {
    anthropicApiKey,
    context,
    existingPlan,
    independentRegen,
    onlyMemberId,
    regenerateMemberId,
    regenScope,
    suppressTargetedMember,
    onProgress,
  } = params;
  let totalIn = 0;
  let totalOut = 0;
  // Tiered models: skeleton and day phases may run on different models with
  // different per-token prices, so cost is summed per call from each phase's
  // actual model rather than re-priced once at the end with a single model.
  let totalCost = 0;

  // The week is anchored to the generation day (carried over on incremental
  // member changes). Day names are computed from this anchor, not the model.
  const weekStart = existingPlan?.week_start_date ?? riyadhTodayISO();

  const beneficiaries = getBeneficiaries(context);
  const nameById = new Map(
    beneficiaries.map((b) => [b.member_id, b.member_name_ar]),
  );
  const isChildById = new Map<string, boolean>([
    [
      "mom",
      context.mom.member_type === "child" ||
        (context.mom.age != null && context.mom.age < 18),
    ],
    ...context.family_members.map(
      (m) => [m.id, m.is_child] as [string, boolean],
    ),
  ]);
  // meal_mode per beneficiary (mom + family members). Used so the family dish grid
  // below is seeded ONLY from members who actually eat the shared menu — an
  // independent member (incl. the mom herself) has private dishes that must not
  // become the anchor a newly-added shared member aligns to.
  const mealModeById = new Map<string, "shared" | "independent">([
    ["mom", context.mom.meal_mode],
    ...context.family_members.map(
      (m) => [m.id, m.meal_mode] as [string, "shared" | "independent"],
    ),
  ]);
  // Beneficiaries who eat their OWN dishes. Passed to resyncSharedMeals so a dish
  // that collides by name with the family's can never merge them into a shared
  // batch, and used below to keep them off the aligned family dish grid. This is
  // what makes switching the mom (or a member) to 'independent' actually take.
  const independentIds = new Set<string>(
    [...mealModeById].filter(([, mode]) => mode === "independent").map(([id]) => id),
  );

  // ── Analyse the prior plan: per-(member, day) carry-over and the family grid ──
  // Each member keeps its COMPLETED days verbatim; only its empty/missing (member,
  // day) cells are generated. familyDishGrid holds, per day, the dishes that ANY
  // member already has — so new members and gap-fills align to the family's menu.
  const priorById = new Map(
    (existingPlan?.members ?? []).map((m) => [m.member_id, m] as const),
  );
  let familyDayIndices: number[] = [];
  const familyDishGrid = new Map<
    number,
    { slot: Meal["slot"]; slot_name_ar: string; recipe_name_ar: string }[]
  >();
  if (existingPlan && existingPlan.members.length > 0) {
    familyDayIndices = Array.from(
      new Set(
        existingPlan.members.flatMap((m) => m.days.map((d) => d.day_index)),
      ),
    ).sort((a, b) => a - b);
    for (const di of familyDayIndices) {
      for (const m of existingPlan.members) {
        // Only a SHARED member's dishes define the family menu. An independent
        // member has their own private dishes; if we seeded the grid from them, a
        // newly-added shared member would align to the independent member's menu
        // instead of the actual shared members'. When no shared member has this
        // day, the grid stays empty for it — a lone shared member then gets a
        // skeleton (fresh dishes), correct since there's no one to share with.
        if (mealModeById.get(m.member_id) === "independent") continue;
        const day = m.days.find((d) => d.day_index === di);
        if (day && day.meals.length > 0) {
          familyDishGrid.set(
            di,
            day.meals.map((mm) => ({
              slot: mm.slot,
              slot_name_ar: mm.slot_name_ar,
              recipe_name_ar: mm.recipe_name_ar,
            })),
          );
          break;
        }
      }
    }
  }
  // Completed days each beneficiary already has — carried over byte-identical.
  const carriedDays = new Map<string, Map<number, Day>>(); // member_id → di → Day
  for (const b of beneficiaries) {
    const dm = new Map<number, Day>();
    for (const d of priorById.get(b.member_id)?.days ?? [])
      if (d.meals.length > 0) dm.set(d.day_index, d);
    carriedDays.set(b.member_id, dm);
  }

  // ── Literal partial regenerate: force only the in-scope (member, day) cells to
  // regenerate; everything else stays carried. The cleared days are regenerated
  // fresh, then their out-of-scope meals are spliced back verbatim (per-day loop).
  const partialScope =
    regenScope && existingPlan && regenerateMemberId
      ? resolvePartialScope(existingPlan, regenerateMemberId, regenScope)
      : null;
  if (partialScope) {
    for (const [memberId, byDay] of partialScope.inScopeByMemberDay) {
      const carried = carriedDays.get(memberId);
      if (!carried) continue;
      for (const [di, flags] of byDay)
        if (flags.some(Boolean)) carried.delete(di); // in-scope day → regenerate
    }
  }

  // A member is complete iff it carried every family day. Fresh plan (no prior) →
  // everyone generates. Concrete missing-day lists are derived later, once the
  // day grid is known (it comes from the skeleton on a from-scratch plan).
  const isComplete = (b: { member_id: string }) =>
    existingPlan != null &&
    familyDayIndices.length > 0 &&
    familyDayIndices.every((di) => carriedDays.get(b.member_id)!.has(di));
  // When a run targets ONE member (one-at-a-time add/complete), generate only it;
  // every other member is carried verbatim — including any empty/failed days,
  // which a later member's run must never re-touch (UI shows them "failed").
  const membersToGenerate = beneficiaries.filter(
    (b) => !isComplete(b) && (!onlyMemberId || b.member_id === onlyMemberId),
  );

  // The single member this run is filling: an explicit onlyMemberId (one-at-a-time
  // add), OR — for a per-member edit/regenerate — the lone incremental member being
  // regenerated (the others are carried). Stamped into plan_data.generating_member_id
  // so the loading screen names the right person and the per-member spinners scope to
  // them. Undefined on an initial full-family run (every member generates).
  const targetedMemberId =
    onlyMemberId ??
    (suppressTargetedMember ? undefined : regenerateMemberId) ??
    (existingPlan && membersToGenerate.length === 1
      ? membersToGenerate[0]!.member_id
      : undefined);

  // ── Fast path: every member complete → return the prior plan untouched ──
  if (existingPlan && membersToGenerate.length === 0) {
    const members = beneficiaries.map((b) => {
      const m = priorById.get(b.member_id)!;
      return { ...m, member_name_ar: nameById.get(b.member_id) ?? m.member_name_ar };
    });
    const plan = MealPlanSchema.parse({
      week_start_date: weekStart,
      members,
      methodology_notes_ar: existingPlan?.methodology_notes_ar,
      safety_disclaimer_ar: existingPlan?.safety_disclaimer_ar,
      days_total: familyDayIndices.length || members[0]?.days.length || 7,
      generating: false,
    });
    if (onProgress)
      await Promise.resolve(onProgress(plan, { readyDays: 0, totalDays: 0 }));
    return { plan, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 }, missingDays: [] };
  }

  // ── Pre-dissolve carried shares w.r.t. the member(s) being regenerated ──
  // A carried member's prior shared meals still list the member we're about to
  // regenerate. Until that member's NEW day lands — and on any day that fails — the
  // OTHER members must not keep showing the stale share. Re-sync each carried family
  // day with the regenerated members passed as empty `fresh` inputs: they contribute
  // no meals, so they're dropped from any carried batch that referenced them (the
  // remaining members' own portions re-form the batch, or it dissolves to individual).
  // Groups that don't reference a regenerated member pass through byte-identical.
  // Successful days then re-form genuine shares in the generation loop below.
  // Skipped for a partial scope: there, only in-scope dishes change, and the
  // per-day scoped splice keeps out-of-scope shares consistent on both sides —
  // whole-member dissolution here would wrongly drop an affected member from an
  // OUT-of-scope dish they still eat.
  if (!partialScope && existingPlan && beneficiaries.length > 1 && familyDayIndices.length > 0) {
    const regenIds = membersToGenerate.map((b) => b.member_id);
    for (const di of familyDayIndices) {
      const inputs: MemberDayMeals[] = [];
      for (const b of beneficiaries) {
        const day = carriedDays.get(b.member_id)!.get(di);
        if (day && day.meals.length > 0)
          inputs.push({ member_id: b.member_id, meals: day.meals, fresh: false });
      }
      if (!inputs.some((i) => !i.fresh)) continue; // no carried meals this day
      for (const id of regenIds)
        if (!inputs.some((i) => i.member_id === id))
          inputs.push({ member_id: id, meals: [], fresh: true });
      const resynced = resyncSharedMeals(inputs, independentIds);
      for (const b of beneficiaries) {
        const day = carriedDays.get(b.member_id)!.get(di);
        if (!day || day.meals.length === 0) continue;
        const newMeals = resynced.get(b.member_id);
        if (!newMeals) continue;
        const changed =
          newMeals.length !== day.meals.length ||
          newMeals.some((m, i) => m !== day.meals[i]);
        if (changed)
          carriedDays
            .get(b.member_id)!
            .set(di, { ...day, meals: newMeals, day_total: sumDayTotal(newMeals) });
      }
    }
  }

  // Incremental add/edit: open the plan IMMEDIATELY (before the skeleton call)
  // with the carried-over members intact and the new/edited member as an empty
  // loading placeholder — so the user never sees a full-screen "generating"
  // screen that hides the prior plan while the skeleton runs.
  if (onProgress && existingPlan && familyDayIndices.length > 0) {
    const preMembers: MemberPlan[] = beneficiaries.map((b) => {
      const prior = priorById.get(b.member_id);
      const carried = carriedDays.get(b.member_id)!;
      return {
        member_id: b.member_id,
        member_name_ar: nameById.get(b.member_id) ?? prior?.member_name_ar ?? "",
        primary_goal: prior?.primary_goal,
        daily_calories_target: prior?.daily_calories_target ?? 0,
        macros_target: prior?.macros_target ?? { protein_g: 0, carbs_g: 0, fat_g: 0 },
        days: familyDayIndices.map(
          (di) =>
            carried.get(di) ?? {
              day_index: di,
              day_name_ar: khaleejiDayName(weekStart, di),
              meals: [],
              day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            },
        ),
      };
    });
    const preShell: MealPlan = {
      week_start_date: weekStart,
      members: preMembers,
      methodology_notes_ar: existingPlan?.methodology_notes_ar,
      safety_disclaimer_ar: existingPlan?.safety_disclaimer_ar,
      days_total: familyDayIndices.length,
      generating: true,
      // Name the targeted member from the very first emit so the loading screen
      // shows the right person while the skeleton runs (matches snapshot() below).
      generating_member_id: targetedMemberId,
      // Manual per-member regenerate marker (counted for the weekly per-member
      // regen quota). Undefined for new plans / adds / drains.
      regenerated_for: regenerateMemberId,
    };
    await Promise.resolve(
      onProgress(preShell, { readyDays: 0, totalDays: familyDayIndices.length }),
    ).catch((e) => console.error("[plan-generate] pre-skeleton onProgress failed", e));
  }

  // ── Phase 1: skeleton ONLY for members that need fresh dishes ──
  // A member needs a skeleton when it has a missing day with no dish source from
  // the family grid: a brand-new member, or a partial member whose gap day is
  // missing family-wide. Existing members reuse their prior targets + dishes, so
  // a pure gap-fill that aligns to the family menu needs no skeleton call at all.
  const needsSkeleton = membersToGenerate.filter((b) => {
    if (!existingPlan || !priorById.has(b.member_id)) return true; // fresh / new
    return familyDayIndices.some(
      (di) => !carriedDays.get(b.member_id)!.has(di) && !familyDishGrid.get(di)?.length,
    );
  });

  let skeleton: PlanSkeleton;
  if (needsSkeleton.length > 0) {
    const skeletonSystemPrompt = buildSkeletonPrompt(
      context,
      needsSkeleton.map((b) => b.member_id),
    );
    // Cap + timeout scale with the members being skeletoned: a full family-tier
    // run (up to 6) emits a week of dish names per member and was truncating at
    // the old fixed 16000, which threw and failed the WHOLE generation.
    const skeletonCap = skeletonMaxTokens(needsSkeleton.length);
    const skeletonTimeout = bigCallTimeoutMs(needsSkeleton.length, false);
    const runSkeleton = (maxTokens: number) =>
      streamAnthropic({
        apiKey: anthropicApiKey,
        model: SKELETON_MODEL,
        maxTokens,
        systemStatic: STATIC_SYSTEM,
        systemPrompt: skeletonSystemPrompt,
        timeoutMs: skeletonTimeout,
      });
    let sk = await runSkeleton(skeletonCap);
    totalIn += sk.tokensIn;
    totalOut += sk.tokensOut;
    totalCost += computeCostUsd(sk.tokensIn, sk.tokensOut, SKELETON_MODEL);
    // A truncated skeleton (stop_reason=max_tokens) yields invalid JSON and kills
    // the whole generation. Retry ONCE at double the cap (clamped to the model
    // ceiling) before giving up — counts the wasted first attempt's tokens toward
    // cost accounting.
    if (sk.stopReason === "max_tokens") {
      const retryMax = Math.min(MAX_OUTPUT_TOKENS, skeletonCap * 2);
      console.warn(
        `[plan-generate] skeleton truncated at ${skeletonCap} — retrying with ${retryMax}`,
      );
      sk = await runSkeleton(retryMax);
      totalIn += sk.tokensIn;
      totalOut += sk.tokensOut;
      totalCost += computeCostUsd(sk.tokensIn, sk.tokensOut, SKELETON_MODEL);
      if (sk.stopReason === "max_tokens")
        throw new PlanValidationError(
          `Skeleton hit max_tokens (${retryMax})`,
          sk.text,
        );
    }
    if (!sk.text.trim())
      throw new PlanValidationError("Empty skeleton from Anthropic", sk.text);
    try {
      const parsed = JSON.parse(stripMarkdownFence(sk.text));
      const r = PlanSkeletonSchema.safeParse(parsed);
      if (!r.success)
        throw new PlanValidationError(
          `Skeleton failed validation: ${r.error.message.slice(0, 300)}`,
          sk.text,
        );
      skeleton = r.data;
    } catch (e) {
      if (e instanceof PlanValidationError) throw e;
      throw new PlanValidationError(
        `Skeleton JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
        sk.text,
      );
    }
  } else {
    // Pure gap-fill aligned to the family menu — no dishes to invent.
    skeleton = {
      members: [],
      methodology_notes_ar: existingPlan?.methodology_notes_ar,
      safety_disclaimer_ar: existingPlan?.safety_disclaimer_ar,
    };
  }
  const skeletonById = new Map(skeleton.members.map((m) => [m.member_id, m]));

  // Day grid: the family's (when carrying over) else the skeleton's own.
  const dayIndices =
    familyDayIndices.length > 0
      ? familyDayIndices
      : Array.from(
          new Set(skeleton.members.flatMap((m) => m.days.map((d) => d.day_index))),
        ).sort((a, b) => a - b);
  const totalDays = dayIndices.length;
  // Day names are computed from the week anchor (generation day), not the model
  // or the prior plan — deterministic and consistent across regenerations.
  const dayNameByIndex = new Map<number, string>();
  for (const di of dayIndices) {
    dayNameByIndex.set(di, khaleejiDayName(weekStart, di));
  }

  // Concrete missing-day lists, now that the day grid is known. Carried days are
  // never in this list, so they're never regenerated.
  const missingByMember = new Map<string, number[]>();
  for (const b of beneficiaries) {
    const carried = carriedDays.get(b.member_id)!;
    missingByMember.set(
      b.member_id,
      dayIndices.filter((di) => !carried.has(di)),
    );
  }

  // Align members to the family's existing dishes (same dish each day) — unless
  // this is an independent per-member regen, where the member gets fresh dishes.
  // workingSkeleton is the UNION of members with any missing day: targets come
  // from the prior plan for existing members (skeleton for new), per-day dishes
  // from the aligned family grid first, then the member's own skeleton day.
  // A partial scope regenerates fresh dishes for the in-scope slots, so it never
  // aligns to the (unchanged) family grid — otherwise it would reproduce the same
  // dishes. Affected members are generated together so a shared in-scope dish
  // re-forms one batch (the day prompt's shared rule).
  const aligned = familyDishGrid.size > 0 && !independentRegen && !partialScope;
  const workingSkeleton: PlanSkeleton = {
    ...skeleton,
    members: membersToGenerate
      .filter((b) => missingByMember.get(b.member_id)!.length > 0)
      .map((b) => {
        const prior = priorById.get(b.member_id);
        const skM = skeletonById.get(b.member_id);
        const targets = prior
          ? {
              primary_goal: prior.primary_goal,
              daily_calories_target: prior.daily_calories_target,
              macros_target: prior.macros_target,
            }
          : {
              primary_goal: skM?.primary_goal,
              daily_calories_target: skM?.daily_calories_target ?? 0,
              macros_target: skM?.macros_target ?? {
                protein_g: 0,
                carbs_g: 0,
                fat_g: 0,
              },
            };
        // An independent member never aligns to the family dish grid — they get
        // their own skeleton dishes even in an aligned (shared-grid) run.
        const alignThis = aligned && !independentIds.has(b.member_id);
        return {
          member_id: b.member_id,
          ...targets,
          days: dayIndices.map((di) => ({
            day_index: di,
            day_name_ar: dayNameByIndex.get(di)!,
            meals: alignThis
              ? (familyDishGrid.get(di) ??
                skM?.days.find((d) => d.day_index === di)?.meals ??
                [])
              : (skM?.days.find((d) => d.day_index === di)?.meals ?? []),
          })),
        };
      }),
  };

  // ── Assembly: seed each member's carried days verbatim, shell missing days ──
  const daysByMember = new Map<string, Map<number, Day>>();
  const targetsById = new Map<
    string,
    {
      primary_goal?: MemberPlan["primary_goal"];
      daily_calories_target: number;
      macros_target: MemberPlan["macros_target"];
    }
  >();
  for (const b of beneficiaries) {
    const dmap = new Map<number, Day>();
    for (const [di, day] of carriedDays.get(b.member_id)!) dmap.set(di, day);
    for (const di of missingByMember.get(b.member_id)!)
      dmap.set(di, {
        day_index: di,
        day_name_ar: dayNameByIndex.get(di)!,
        meals: [],
        day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      });
    daysByMember.set(b.member_id, dmap);
    const prior = priorById.get(b.member_id);
    const skM = skeletonById.get(b.member_id);
    targetsById.set(
      b.member_id,
      prior
        ? {
            primary_goal: prior.primary_goal,
            daily_calories_target: prior.daily_calories_target,
            macros_target: prior.macros_target,
          }
        : {
            primary_goal: skM?.primary_goal,
            daily_calories_target: skM?.daily_calories_target ?? 0,
            macros_target: skM?.macros_target ?? {
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
            },
          },
    );
  }
  const done = new Set<number>(); // generated days completed successfully
  const failedDays = new Set<number>(); // days dropped after retries exhausted
  const dayErrors: string[] = []; // per-day failure messages, for the fatal-throw cause

  // Generate starting from TODAY so the day the user is viewing fills first, then
  // forward (wrapping earlier days to the end). Order only — day_index unchanged.
  const startMs = Date.parse(`${weekStart}T00:00:00Z`);
  const todayMs = Date.parse(`${riyadhTodayISO()}T00:00:00Z`);
  const todayIndex =
    Number.isNaN(startMs) || Number.isNaN(todayMs)
      ? -1
      : Math.round((todayMs - startMs) / 86_400_000);
  const startPos = dayIndices.indexOf(todayIndex);
  const generationOrder =
    startPos > 0
      ? [...dayIndices.slice(startPos), ...dayIndices.slice(0, startPos)]
      : dayIndices; // today is day 0, or outside the week → keep ascending
  // Only days some member is missing get an API call; days everyone already has
  // are skipped entirely. genDayCount drives the `generating` flag/progress so it
  // reflects real work and flips off when the last gap settles (carried days show
  // ready from the first emit).
  const daysToGenerate = generationOrder.filter((di) =>
    membersToGenerate.some((b) => missingByMember.get(b.member_id)!.includes(di)),
  );
  const genDayCount = daysToGenerate.length;

  const snapshot = (generating: boolean): MealPlan => ({
    week_start_date: weekStart,
    members: beneficiaries.map((b) => {
      const t = targetsById.get(b.member_id)!;
      return {
        member_id: b.member_id,
        member_name_ar: nameById.get(b.member_id) ?? "",
        primary_goal: t.primary_goal,
        daily_calories_target: t.daily_calories_target,
        macros_target: t.macros_target,
        days: [...daysByMember.get(b.member_id)!.values()].sort(
          (a, b2) => a.day_index - b2.day_index,
        ),
      };
    }),
    methodology_notes_ar:
      skeleton.methodology_notes_ar ?? existingPlan?.methodology_notes_ar,
    safety_disclaimer_ar:
      skeleton.safety_disclaimer_ar ?? existingPlan?.safety_disclaimer_ar,
    days_total: totalDays,
    generating,
    // While generating a single targeted member, tell the UI who — so the loading
    // screen names them and its spinners scope to that member (a different member's
    // empty/failed day doesn't render as "loading"). Covers adds (onlyMemberId) AND
    // per-member edit/regenerate (targetedMemberId). Cleared on the final plan.
    generating_member_id: generating && targetedMemberId ? targetedMemberId : undefined,
    // Manual per-member regenerate marker — persisted on the FINAL plan too (unlike
    // generating_member_id) so the weekly per-member regen quota can be counted from
    // plan_data. Undefined for new plans / adds / drains.
    regenerated_for: regenerateMemberId,
    // Drain (onlyMemberId): bump so a deterministically-failing day eventually caps.
    // Manual per-member regen (regenerateMemberId): RESET that member's count so the
    // drain gets a fresh budget if a day fails again. Else carry the prior counts.
    gen_attempts: onlyMemberId
      ? {
          ...(existingPlan?.gen_attempts ?? {}),
          [onlyMemberId]: (existingPlan?.gen_attempts?.[onlyMemberId] ?? 0) + 1,
        }
      : regenerateMemberId
        ? { ...(existingPlan?.gen_attempts ?? {}), [regenerateMemberId]: 0 }
        : existingPlan?.gen_attempts,
  });

  // Serialize onProgress writes.
  let progressTail: Promise<void> = Promise.resolve();
  const emit = () => {
    if (!onProgress) return;
    // `generating` stays true only while days are still UNATTEMPTED. A failed day
    // counts as attempted (it lands in failedDays, never `done`), so without it a
    // single failure would strand `done.size < genDayCount` → the loader spins
    // forever even though every day has been tried. Count done + failed.
    const snap = snapshot(done.size + failedDays.size < genDayCount);
    const readyDays = done.size;
    progressTail = progressTail.then(() =>
      Promise.resolve(
        onProgress(snap, { readyDays, totalDays: genDayCount }),
      ).catch((e) => console.error("[plan-generate] onProgress failed", e)),
    );
  };

  // Open the plan immediately: existing members complete, new members loading.
  emit();

  // ── Phase 2: expand each missing day; per day, only the members missing it ──
  // Per-day cap, timeout, and loop concurrency all scale with the work: a big
  // independent family with a housekeeper translation emits ~6× the recipes of a
  // solo plan, so a fixed cap truncated days (dropping them) and a fixed 4-min
  // timeout aborted them; parallelizing keeps 7 big days inside the function budget.
  const hasTranslation = !!context.housekeeper_locale;
  const dayLoopConcurrency = dayConcurrency(
    membersToGenerate.length,
    hasTranslation,
  );
  const generateDay = async (dayIndex: number): Promise<void> => {
    const dayMemberIds = new Set(
      membersToGenerate
        .filter((b) => missingByMember.get(b.member_id)!.includes(dayIndex))
        .map((b) => b.member_id),
    );
    const daySkeleton: PlanSkeleton = {
      ...workingSkeleton,
      members: workingSkeleton.members.filter((m) =>
        dayMemberIds.has(m.member_id),
      ),
    };
    const prompt = buildDayPrompt(
      context,
      daySkeleton,
      dayIndex,
      dayNameByIndex.get(dayIndex),
    );
    // Size this day's cap + timeout to the members actually missing it.
    let dayCap = dayMaxTokens(dayMemberIds.size, hasTranslation);
    const dayTimeout = bigCallTimeoutMs(dayMemberIds.size, hasTranslation);
    let apiAttempt = 0; // 429/529/5xx/overload/stream/timeout retries (honor Retry-After)
    let contentAttempt = 0; // re-rolls for a one-off malformed/invalid model response
    let tokensRetried = false; // one doubled-cap retry on truncation
    for (;;) {
      try {
        const res = await streamAnthropic({
          apiKey: anthropicApiKey,
          model: DAY_MODEL,
          maxTokens: dayCap,
          systemStatic: STATIC_SYSTEM,
          systemPrompt: prompt,
          timeoutMs: dayTimeout,
        });
        totalIn += res.tokensIn;
        totalOut += res.tokensOut;
        totalCost += computeCostUsd(res.tokensIn, res.tokensOut, DAY_MODEL);
        if (res.stopReason === "max_tokens") {
          // Truncated. Re-rolling at the same cap will truncate again — retry once
          // at a doubled cap (mirrors the skeleton retry) before failing the day.
          if (!tokensRetried && dayCap < MAX_OUTPUT_TOKENS) {
            tokensRetried = true;
            dayCap = Math.min(MAX_OUTPUT_TOKENS, dayCap * 2);
            continue;
          }
          throw new PlanValidationError(
            `Day ${dayIndex} hit max_tokens (${dayCap})`,
            res.text,
          );
        }
        // The day prompt asks for a terse-keyed slice (short keys to cut output
        // tokens); expand it back to the canonical DaySlice shape — and fill
        // slot_name_ar from slot — BEFORE validation. The expander tolerates
        // canonical keys too, so an occasional non-terse meal still parses.
        const parsed = expandTerseDaySlice(
          JSON.parse(stripMarkdownFence(res.text)),
        );
        const r = DaySliceSchema.safeParse(parsed);
        if (!r.success)
          throw new PlanValidationError(
            `Day ${dayIndex} failed validation: ${r.error.message.slice(0, 300)}`,
            res.text,
          );
        const slice = r.data;

        // Re-sync shared meals across the WHOLE family for this day — not just the
        // members regenerated now. The fresh members' raw single portions plus every
        // OTHER beneficiary's carried meals are re-grouped by emitted dish name, so a
        // shared batch that the edited member joins/leaves is recomputed on the carried
        // members too (Issue 3), while a member whose profile no longer fits the dish
        // is left individual (Issue 1). Carried members untouched by this run keep
        // their meals byte-for-byte. Solo plans (1 beneficiary) never share.
        const fresh = new Map(
          slice.members.map((m) => [m.member_id, m.meals] as const),
        );

        if (partialScope) {
          // ── Partial scope: regenerate ONLY the in-scope slots; splice the rest ──
          // Per affected member: pull this day's fresh meals into their original
          // frame's in-scope slots (matched by slot type), re-form shared batches
          // ACROSS the affected members (so a shared in-scope dish stays one batch),
          // and keep every out-of-scope meal byte-for-byte. Non-affected members are
          // never touched here. Members in dayMemberIds without a scope entry (e.g. a
          // pre-existing failed day) fall through to a normal full-day write.
          const inScopeInputs: MemberDayMeals[] = [];
          const positionsByMember = new Map<string, number[]>();
          const framesByMember = new Map<string, Meal[]>();
          const plainFresh: string[] = [];
          for (const id of dayMemberIds) {
            const byDay = partialScope.inScopeByMemberDay.get(id);
            const flags = byDay?.get(dayIndex);
            const frame =
              priorById.get(id)?.days.find((d) => d.day_index === dayIndex)?.meals;
            if (!flags || !frame) {
              plainFresh.push(id); // no scope frame → treat as a normal full regen
              continue;
            }
            framesByMember.set(id, frame);
            const extracted = extractInScopeFresh(frame, flags, fresh.get(id) ?? []);
            const positions: number[] = [];
            const meals: Meal[] = [];
            extracted.forEach((m, i) => {
              if (m) {
                positions.push(i);
                meals.push(m);
              }
            });
            positionsByMember.set(id, positions);
            inScopeInputs.push({ member_id: id, meals, fresh: true });
          }
          // Re-form shared batches among the in-scope fresh single portions only.
          let reassembled: Map<string, Meal[]>;
          if (inScopeInputs.length > 1) {
            try {
              reassembled = resyncSharedMeals(inScopeInputs, independentIds);
            } catch (resyncErr) {
              console.warn(
                `[plan-generate] partial resyncSharedMeals failed for day ${dayIndex}; using un-merged in-scope meals:`,
                resyncErr instanceof Error ? resyncErr.message : String(resyncErr),
              );
              reassembled = new Map(inScopeInputs.map((d) => [d.member_id, d.meals]));
            }
          } else {
            reassembled = new Map(inScopeInputs.map((d) => [d.member_id, d.meals]));
          }

          for (const id of dayMemberIds) {
            if (plainFresh.includes(id)) {
              const meals = fresh.get(id) ?? [];
              daysByMember.get(id)!.set(dayIndex, {
                day_index: dayIndex,
                day_name_ar: dayNameByIndex.get(dayIndex) ?? `اليوم ${dayIndex + 1}`,
                meals,
                day_total: sumDayTotal(meals),
              });
              continue;
            }
            const frame = framesByMember.get(id)!;
            const positions = positionsByMember.get(id) ?? [];
            const assembledInScope = reassembled.get(id) ?? [];
            const merged = frame.slice(); // out-of-scope meals preserved verbatim
            positions.forEach((pos, k) => {
              if (assembledInScope[k]) merged[pos] = assembledInScope[k]!;
            });
            daysByMember.get(id)!.set(dayIndex, {
              day_index: dayIndex,
              day_name_ar:
                priorById.get(id)?.days.find((d) => d.day_index === dayIndex)
                  ?.day_name_ar ??
                dayNameByIndex.get(dayIndex) ??
                `اليوم ${dayIndex + 1}`,
              meals: merged,
              day_total: sumDayTotal(merged),
            });
          }
          done.add(dayIndex);
          emit();
          return;
        }

        const dayInputs: MemberDayMeals[] = [];
        for (const b of beneficiaries) {
          if (dayMemberIds.has(b.member_id)) {
            dayInputs.push({
              member_id: b.member_id,
              meals: fresh.get(b.member_id) ?? [],
              fresh: true,
            });
          } else {
            const carried = daysByMember.get(b.member_id)!.get(dayIndex);
            if (carried && carried.meals.length > 0)
              dayInputs.push({
                member_id: b.member_id,
                meals: carried.meals,
                fresh: false,
              });
          }
        }
        let assembled: Map<string, Meal[]>;
        if (beneficiaries.length > 1) {
          try {
            assembled = resyncSharedMeals(dayInputs, independentIds);
          } catch (resyncErr) {
            // A deterministic assembly throw is a logic bug, not a bad model
            // response — don't drop a good day over it; fall back to un-merged
            // individual meals so the day still lands.
            console.warn(
              `[plan-generate] resyncSharedMeals failed for day ${dayIndex}; using un-merged meals:`,
              resyncErr instanceof Error ? resyncErr.message : String(resyncErr),
            );
            assembled = new Map(dayInputs.map((d) => [d.member_id, d.meals]));
          }
        } else {
          assembled = new Map(dayInputs.map((d) => [d.member_id, d.meals]));
        }

        for (const di of dayInputs) {
          const meals = assembled.get(di.member_id) ?? di.meals;
          if (di.fresh) {
            daysByMember.get(di.member_id)!.set(dayIndex, {
              day_index: dayIndex,
              day_name_ar: dayNameByIndex.get(dayIndex) ?? `اليوم ${dayIndex + 1}`,
              meals,
              day_total: sumDayTotal(meals),
            });
          } else {
            // Carried member: only rewrite their day when the re-sync actually
            // changed it (a shared batch they share with the edited member). When
            // unchanged, keep the carried Day object verbatim (preserves its
            // day_name_ar + byte-identical content).
            const carried = daysByMember.get(di.member_id)!.get(dayIndex)!;
            const changed =
              meals.length !== carried.meals.length ||
              meals.some((m, i) => m !== carried.meals[i]);
            if (changed)
              daysByMember.get(di.member_id)!.set(dayIndex, {
                day_index: dayIndex,
                day_name_ar: carried.day_name_ar,
                meals,
                day_total: sumDayTotal(meals),
              });
          }
        }
        done.add(dayIndex);
        emit();
        return;
      } catch (err) {
        // (1) API-transient (rate limit / overload / timeout): retry honoring Retry-After.
        if (isRetryable(err) && apiAttempt < MAX_RETRIES) {
          apiAttempt++;
          const ra =
            err instanceof AnthropicCallError ? err.retryAfterMs : undefined;
          await sleep(retryWaitMs(apiAttempt, ra));
          continue;
        }
        // (2) Transient CONTENT failure (malformed JSON / schema mismatch): re-roll a
        // couple times — a fresh roll usually parses (what the manual "regenerate"
        // button does). Excludes max_tokens (doubled-cap retry above) and logic
        // errors like a resync TypeError (deterministic → fail fast so they surface).
        if (isTransientContentError(err) && contentAttempt < CONTENT_MAX_RETRIES) {
          contentAttempt++;
          await sleep(retryWaitMs(contentAttempt));
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[plan-generate] day failed (omitting)", dayIndex, msg);
        dayErrors.push(msg);
        failedDays.add(dayIndex);
        emit();
        return;
      }
    }
  };

  await mapWithConcurrency(daysToGenerate, dayLoopConcurrency, generateDay);

  // Second-chance pass (in-run): give days that exhausted their per-day retry
  // budget ONE more fresh full attempt within this same invocation, so a flaky
  // model miss recovers here instead of being deferred to the drain — a separate
  // background round-trip that refills the day minutes later and out of order
  // (an early day still "preparing" while later days are already done). Bounded
  // to a single extra wave; anything still failing falls through to the drain
  // exactly as before. Skipped when nothing failed, or when EVERY day failed
  // (that run throws below — a second wave wouldn't change the outcome).
  if (failedDays.size > 0 && done.size > 0) {
    const retryDays = daysToGenerate.filter((di) => failedDays.has(di));
    failedDays.clear();
    await mapWithConcurrency(retryDays, dayLoopConcurrency, generateDay);
  }

  await progressTail;

  // Fatal only if nothing was carried over AND nothing generated.
  const nothingCarried = beneficiaries.every(
    (b) => carriedDays.get(b.member_id)!.size === 0,
  );
  if (done.size === 0 && nothingCarried) {
    const cause = summarizeDayErrors(dayErrors);
    throw new PlanValidationError(
      `All ${genDayCount} day generations failed${cause ? ` — ${cause}` : ""}`,
    );
  }

  // ── Final assembled MealPlan ──
  const result = MealPlanSchema.safeParse(snapshot(false));
  if (!result.success)
    throw new PlanValidationError(
      `Assembled plan failed validation: ${result.error.message.slice(0, 400)}`,
    );
  const plan: MealPlan = result.data;

  // Carry-over invariant (log-only tripwire): a carried member's OWN dishes must
  // never change — adding or editing one member may update the shared BATCH a
  // carried member shares with the edited one (totals/split/membership), but it
  // must never rewrite which dishes that carried member eats. We therefore compare
  // each carried day's own-dish fingerprint (slot + normalized own recipe name,
  // ignoring batch amounts/translations) rather than the whole day. A mismatch
  // means a regression started rewriting carried members' meals.
  const ownDishFingerprint = (d: Day) =>
    JSON.stringify(
      d.meals
        .map(
          (m) =>
            `${m.slot}|${normalizeDishKey(m.own_portion?.recipe_name_ar ?? m.recipe_name_ar)}`,
        )
        .sort(),
    );
  for (const [memberId, carried] of carriedDays) {
    if (carried.size === 0) continue;
    const out = plan.members.find((m) => m.member_id === memberId);
    for (const [di, original] of carried) {
      const outDay = out?.days.find((d) => d.day_index === di);
      if (!outDay || ownDishFingerprint(outDay) !== ownDishFingerprint(original)) {
        console.warn("[plan-generate] carry-over invariant violated", {
          memberId,
          dayIndex: di,
        });
      }
    }
  }

  // Non-fatal numeric guards (skip existing members — targets already validated).
  for (const memberPlan of plan.members) {
    if (priorById.has(memberPlan.member_id)) continue;
    const isChild = isChildById.get(memberPlan.member_id) ?? false;
    if (!isChild && memberPlan.daily_calories_target < 1400) {
      console.warn(
        "[plan-generate] adult calories below 1400 floor for",
        memberPlan.member_id,
        ":",
        memberPlan.daily_calories_target,
      );
    }
    const { protein_g, carbs_g, fat_g } = memberPlan.macros_target;
    const calcKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
    const drift =
      Math.abs(calcKcal - memberPlan.daily_calories_target) /
      Math.max(memberPlan.daily_calories_target, 1);
    if (drift > 0.1) {
      console.warn(
        "[plan-generate] macro/calorie drift >10% for",
        memberPlan.member_id,
        "— snapping",
        memberPlan.daily_calories_target,
        "→",
        Math.round(calcKcal),
      );
      memberPlan.daily_calories_target = Math.round(calcKcal);
    }
  }

  // Non-fatal cookbook-style guard: surface refined-flour/sugar deviations from
  // Sara's cookbook in logs so the prompt can be tuned. Never blocks generation.
  const REFINED_FLAGS = ["سكر أبيض", "دقيق أبيض", "طحين أبيض"];
  for (const memberPlan of plan.members) {
    for (const day of memberPlan.days) {
      for (const meal of day.meals) {
        const ingredientText = meal.ingredients.map((i) => i.name_ar).join(" ");
        const violations = REFINED_FLAGS.filter((f) => ingredientText.includes(f));
        if (violations.length > 0) {
          console.warn("[plan-generate] cookbook style violation", {
            userId: context.mom.id,
            meal: meal.recipe_name_ar,
            violations,
          });
        }
      }
    }
  }

  // Non-fatal observability guard: if the housekeeper needs translations, flag
  // any meal the AI left untranslated. The housekeeper view degrades to Arabic,
  // so we warn rather than fail the whole plan.
  if (context.housekeeper_locale) {
    let missing = 0;
    for (const memberPlan of plan.members)
      for (const day of memberPlan.days)
        for (const meal of day.meals)
          if (!meal.prep_steps_translated || meal.prep_steps_translated.length === 0)
            missing++;
    if (missing > 0) {
      console.warn(
        "[plan-generate] housekeeper translations missing on",
        missing,
        "meal(s) for locale",
        context.housekeeper_locale,
      );
    }
  }

  return {
    plan,
    usage: {
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: totalCost,
    },
    missingDays: [...failedDays].sort((a, b) => a - b),
    missingDaysCause: summarizeDayErrors(dayErrors),
  };
}

/**
 * Run generation for an already-created meal_plan row and persist the result.
 * Client + key are injected so this runs unchanged in a request (cookie client)
 * or inline in development.
 */
export async function runMealPlanGeneration(params: {
  supabase: AnyClient;
  anthropicApiKey: string;
  mealPlanId: string;
  context: PlanPromptContext;
  existingPlan?: MealPlan | null;
  independentRegen?: boolean;
  onlyMemberId?: string;
  regenerateMemberId?: string;
  regenScope?: "individual" | "shared" | "both";
  suppressTargetedMember?: boolean;
}): Promise<GenerateResult> {
  const {
    supabase,
    anthropicApiKey,
    mealPlanId,
    context,
    existingPlan,
    independentRegen,
    onlyMemberId,
    regenerateMemberId,
    regenScope,
    suppressTargetedMember,
  } = params;
  const startMs = Date.now();

  let plan: MealPlan;
  let usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  let missingDays: number[] = [];
  let missingDaysCause = "";
  try {
    const result = await generateMealPlan({
      anthropicApiKey,
      context,
      existingPlan,
      independentRegen,
      onlyMemberId,
      regenerateMemberId,
      regenScope,
      suppressTargetedMember,
      // Persist progressively; flip "ready" on the first emit (the shell) so the
      // plan opens showing all days loading and they fill in 1→7.
      onProgress: async (snapshot) => {
        await supabase
          .from("meal_plans")
          .update({ status: "ready", plan_data: snapshot })
          .eq("id", mealPlanId);
      },
    });
    plan = result.plan;
    usage = result.usage;
    missingDays = result.missingDays;
    missingDaysCause = result.missingDaysCause ?? "";
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from("plan_generations")
      .update({
        status: "failed",
        duration_ms: durationMs,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("meal_plan_id", mealPlanId);

    await supabase
      .from("meal_plans")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", mealPlanId);

    throw err;
  }

  // End-of-run housekeeper translation. Re-read the housekeeper FRESH (catches a
  // maid added mid-generation, whose locale wasn't in the start context — so
  // context.housekeeper_locale is stale and the meals weren't born-translated).
  // Runs here, before flipping the plan_generations 'started' row to 'completed',
  // so triggerPlanTranslation's busy guard keeps any concurrent translate from
  // racing us. Born-translated plans find nothing to do.
  let finalPlan = plan;
  let extraIn = 0;
  let extraOut = 0;
  let extraCost = 0;
  try {
    const { data: hkRows } = await supabase
      .from("family_members")
      .select("preferred_language")
      .eq("user_id", context.mom.id)
      .eq("role", "housekeeper")
      .limit(1)
      .returns<{ preferred_language: string | null }[]>();
    const hkLang = hkRows?.[0]?.preferred_language ?? undefined;
    const endLocale =
      hkLang && hkLang !== "ar" && (LOCALE_CODES as readonly string[]).includes(hkLang)
        ? (hkLang as LocaleCode)
        : undefined;
    const needsTranslate =
      !!endLocale &&
      plan.members.some((m) =>
        m.days.some((d) =>
          d.meals.some((meal) => meal.prep_steps_translated_locale !== endLocale),
        ),
      );
    // Only translate once the WHOLE family is fully generated — every member, day
    // 1 → last day. Skip while any member is absent OR still has an unfilled day
    // (under the retry cap); the drain finishes them first and a later run
    // translates the complete plan. (Also keeps this run's 'started' lock from
    // being held through translation while members are still pending.)
    const { data: memberRows } = await supabase
      .from("family_members")
      .select("id, role")
      .eq("user_id", context.mom.id)
      .returns<{ id: string; role: string }[]>();
    const familyMemberIds = (memberRows ?? [])
      .filter((m) => m.role !== "housekeeper")
      .map((m) => m.id);
    const stillGenerating = hasPendingGeneration({
      plan,
      familyMemberIds,
      maxAttempts: MEMBER_GEN_MAX_ATTEMPTS,
    });
    if (endLocale && needsTranslate && !stillGenerating) {
      const { plan: translated, usage: tUsage } = await translateMealPlan({
        anthropicApiKey,
        plan,
        locale: endLocale,
        onDayTranslated: async (p) => {
          await supabase.from("meal_plans").update({ plan_data: p }).eq("id", mealPlanId);
        },
      });
      finalPlan = translated;
      extraIn = tUsage.input_tokens;
      extraOut = tUsage.output_tokens;
      extraCost = tUsage.cost_usd;
    }
  } catch (hkErr) {
    // Non-fatal: leave the (untranslated) plan as-is; the maid view falls back to
    // Arabic and her page re-triggers a translate on next visit.
    console.warn("[runMealPlanGeneration] end-of-run housekeeper translate failed", hkErr);
  }

  const durationMs = Date.now() - startMs;
  const generatedAt = new Date().toISOString();

  const { error: updateMealError } = await supabase
    .from("meal_plans")
    .update({
      status: "ready",
      plan_data: finalPlan,
      generated_at: generatedAt,
      ai_input_tokens: usage.input_tokens,
      ai_output_tokens: usage.output_tokens,
      ai_generation_seconds: durationMs / 1000,
    })
    .eq("id", mealPlanId);

  if (updateMealError) {
    throw new Error(`Failed to update meal_plan: ${updateMealError.message}`);
  }

  // Partial plan: some days were dropped after retries. Status stays "completed"
  // (the CHECK allows only started/completed/failed), but record a PII-safe note
  // (day indices only — never recipe/member content) so partials are auditable.
  const partialNote =
    missingDays.length > 0
      ? `partial: days [${missingDays.join(", ")}] failed${missingDaysCause ? ` — ${missingDaysCause}` : ""}`
      : null;
  if (partialNote) {
    console.warn(`[runMealPlanGeneration] ${partialNote}`);
  }

  const { error: updateGenError } = await supabase
    .from("plan_generations")
    .update({
      status: "completed",
      tokens_in: usage.input_tokens + extraIn,
      tokens_out: usage.output_tokens + extraOut,
      cost_usd: usage.cost_usd + extraCost,
      duration_ms: durationMs,
      completed_at: generatedAt,
      error_message: partialNote,
    })
    .eq("meal_plan_id", mealPlanId);

  if (updateGenError) {
    console.error(
      "[runMealPlanGeneration] failed to update plan_generations audit row:",
      updateGenError,
    );
  }

  return {
    plan,
    mealPlanId,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: usage.cost_usd,
      duration_ms: durationMs,
    },
  };
}

/**
 * True when the plan still has generation work left — the gate for maid
 * translation (every trigger) + the maid "preparing" state, so translation only
 * starts once EVERY member is fully generated (day 1 → last day). Mirrors the
 * drain's pickNextMemberId so translation-readiness == generation fully drained:
 *  - any in-plan member missing a mealed day AND still under the retry cap, OR
 *  - any expected (non-housekeeper) family member not yet in the plan.
 * Capped-failed days are excluded (they never improve) so a permanently-stuck day
 * can't block translation forever — it surfaces as "failed", consistent with the
 * generation cap.
 */
export function hasPendingGeneration(params: {
  plan: MealPlan;
  familyMemberIds: string[];
  maxAttempts: number;
}): boolean {
  const { plan, familyMemberIds, maxAttempts } = params;
  const daysTotal = plan.days_total ?? 7;
  const genAttempts = plan.gen_attempts ?? {};
  const anyIncomplete = plan.members.some(
    (m) =>
      m.days.filter((d) => d.meals.length > 0).length < daysTotal &&
      (genAttempts[m.member_id] ?? 0) < maxAttempts,
  );
  if (anyIncomplete) return true;
  const inPlan = new Set(plan.members.map((m) => m.member_id));
  return familyMemberIds.some((id) => !inPlan.has(id));
}

/**
 * True when a generate invocation for this meal_plans row should NO-OP: the
 * row is terminal ('failed'/'archived'), already emitting ('ready' — another
 * invocation is or was streaming), missing entirely, or its DISPATCH
 * plan_generations row (the oldest one for the id — translation audit rows
 * share meal_plan_id but are inserted later) already reached a terminal
 * status. Fresh dispatch state ('generating' + 'started') returns false.
 * A missing generation row alone does not block: the run terminalizes
 * meal_plans regardless. Used by the background function as an idempotency
 * guard against replays / duplicate invocations.
 */
export function generationAlreadySettled(params: {
  mealPlanStatus: string | null | undefined;
  dispatchGenStatus: string | null | undefined;
}): boolean {
  const { mealPlanStatus, dispatchGenStatus } = params;
  if (mealPlanStatus == null) return true; // row missing/deleted
  if (mealPlanStatus !== "generating") return true; // failed/ready/archived
  return dispatchGenStatus === "completed" || dispatchGenStatus === "failed";
}

// ─── Translation pass (housekeeper) ──────────────────────────────────────
// Translates an EXISTING plan's meals into `locale` without regenerating any
// meal content. Fills recipe_name_translated / ingredients_translated /
// prep_steps_translated. Per-day concurrent calls; meals already translated to
// the target locale are skipped.
const TranslateOutSchema = z.array(
  z.object({
    i: z.number().int(),
    recipe_name: z.string(),
    ingredient_names: z.array(z.string()),
    steps: z.array(z.string()),
  }),
);

const NameTranslateOutSchema = z.array(
  z.object({ i: z.number().int(), name: z.string() }),
);

export async function translateMealPlan(params: {
  anthropicApiKey: string;
  plan: MealPlan;
  locale: LocaleCode;
  // Called after each day's meals are translated, with a FULL snapshot of the
  // plan so far. Lets callers persist progressively (today-first) so the maid
  // sees recipes within seconds instead of waiting for all 7 days. Non-fatal.
  onDayTranslated?: (plan: MealPlan) => void | Promise<void>;
}): Promise<{ plan: MealPlan; usage: { input_tokens: number; output_tokens: number; cost_usd: number; model: string } }> {
  const { anthropicApiKey, plan, locale, onDayTranslated } = params;
  let totalIn = 0;
  let totalOut = 0;

  // Deep-clone the parts we mutate so the caller's object is untouched.
  const members: MemberPlan[] = plan.members.map((m) => ({
    ...m,
    days: m.days.map((d) => ({ ...d, meals: d.meals.map((meal) => ({ ...meal })) })),
  }));

  const dayIndices = Array.from(
    new Set(members.flatMap((m) => m.days.map((d) => d.day_index))),
  ).sort((a, b) => a - b);

  // Translate starting from TODAY so the day the maid lands on resolves first,
  // then forward (wrapping earlier days to the end).
  const startMs = Date.parse(`${plan.week_start_date}T00:00:00Z`);
  const todayMs = Date.parse(`${riyadhTodayISO()}T00:00:00Z`);
  const todayIndex =
    Number.isNaN(startMs) || Number.isNaN(todayMs)
      ? -1
      : Math.round((todayMs - startMs) / 86_400_000);
  const startPos = dayIndices.indexOf(todayIndex);
  const order =
    startPos > 0
      ? [...dayIndices.slice(startPos), ...dayIndices.slice(0, startPos)]
      : dayIndices;

  // Translate strictly ONE MEMBER AT A TIME: finish a member's name + all their
  // days before starting the next. Never batch two members into one call and
  // never run two members concurrently — the maid sees one member's full week
  // resolve, then the next. (Day-outer batching used to mix every member's meals
  // into a single per-day call; this is the deliberate member-sequential trade.)
  for (const member of members) {
    // (a) Member name → locale (its own small call). Folding it into the member's
    // block means the member is *fully* localized before the next one begins.
    if (member.member_name_translated_locale !== locale) {
      let nameAttempt = 0;
      for (;;) {
        try {
          const res = await streamAnthropic({
            apiKey: anthropicApiKey,
            model: TRANSLATE_MODEL,
            maxTokens: DAY_MAX_TOKENS,
            systemPrompt: buildNameTranslatePrompt(
              [{ i: 0, name_ar: member.member_name_ar }],
              locale,
            ),
            userMessage: "ترجمي الآن.",
          });
          totalIn += res.tokensIn;
          totalOut += res.tokensOut;
          if (res.stopReason === "max_tokens")
            throw new PlanValidationError("Name translate hit max_tokens", res.text);
          const parsed = NameTranslateOutSchema.safeParse(
            JSON.parse(stripMarkdownFence(res.text)),
          );
          if (!parsed.success)
            throw new PlanValidationError(
              `Name translate failed validation: ${parsed.error.message.slice(0, 200)}`,
              res.text,
            );
          const out = parsed.data[0];
          if (out) {
            member.member_name_translated = out.name;
            member.member_name_translated_locale = locale;
          }
          break;
        } catch (err) {
          if (isRetryable(err) && nameAttempt < MAX_RETRIES) {
            nameAttempt++;
            const nameRetryAfter =
          err instanceof AnthropicCallError ? err.retryAfterMs : undefined;
        await sleep(retryWaitMs(nameAttempt, nameRetryAfter));
            continue;
          }
          // Non-fatal: maid view falls back to the Arabic name.
          console.warn(
            "[translateMealPlan] name translation failed for",
            member.member_id,
            err instanceof Error ? err.message : String(err),
          );
          break;
        }
      }
      // Persist the name immediately so it shows even before this member's meals.
      try {
        await onDayTranslated?.({ ...plan, members });
      } catch (persistErr) {
        console.warn(
          "[translateMealPlan] name progressive persist failed:",
          persistErr instanceof Error ? persistErr.message : String(persistErr),
        );
      }
    }

    // (b) This member's days, today-first, fully sequential.
    for (const dayIndex of order) {
      const day = member.days.find((d) => d.day_index === dayIndex);
      if (!day) continue;
      const refs: Meal[] = day.meals.filter(
        (meal) =>
          !(
            meal.prep_steps_translated_locale === locale &&
            !!meal.prep_steps_translated?.length
          ),
      );
      if (refs.length === 0) continue;

      const items = refs.map((meal, i) => ({
        i,
        recipe_name_ar: meal.recipe_name_ar,
        ingredient_names: meal.ingredients.map((g) => g.name_ar),
        prep_steps_ar: meal.prep_steps_ar,
      }));

      let attempt = 0;
      for (;;) {
        try {
          const res = await streamAnthropic({
            apiKey: anthropicApiKey,
            model: TRANSLATE_MODEL,
            maxTokens: DAY_MAX_TOKENS,
            systemPrompt: buildTranslatePrompt(items, locale),
            userMessage: "ترجمي الآن.",
          });
          totalIn += res.tokensIn;
          totalOut += res.tokensOut;
          if (res.stopReason === "max_tokens")
            throw new PlanValidationError(
              `Translate ${member.member_id} day ${dayIndex} hit max_tokens`,
              res.text,
            );
          const parsed = TranslateOutSchema.safeParse(
            JSON.parse(stripMarkdownFence(res.text)),
          );
          if (!parsed.success)
            throw new PlanValidationError(
              `Translate ${member.member_id} day ${dayIndex} failed validation: ${parsed.error.message.slice(0, 200)}`,
              res.text,
            );
          for (const out of parsed.data) {
            const meal = refs[out.i];
            if (!meal) continue;
            meal.recipe_name_translated = out.recipe_name;
            meal.prep_steps_translated = out.steps;
            meal.prep_steps_translated_locale = locale;
            meal.ingredients_translated = meal.ingredients.map((g, k) => ({
              ...g,
              name_ar: out.ingredient_names[k] ?? g.name_ar,
            }));
          }
          // Progressive snapshot: this member's day landed. `members` is the
          // shared working array, so the snapshot carries all prior progress.
          // Non-fatal: a failed persist must not abort the translation pass.
          try {
            await onDayTranslated?.({ ...plan, members });
          } catch (persistErr) {
            console.warn(
              "[translateMealPlan]",
              member.member_id,
              "day",
              dayIndex,
              "progressive persist failed:",
              persistErr instanceof Error ? persistErr.message : String(persistErr),
            );
          }
          break;
        } catch (err) {
          if (isRetryable(err) && attempt < MAX_RETRIES) {
            attempt++;
            const dayRetryAfter =
          err instanceof AnthropicCallError ? err.retryAfterMs : undefined;
        await sleep(retryWaitMs(attempt, dayRetryAfter));
            continue;
          }
          // Non-fatal: leave this day untranslated (maid view falls back to Arabic).
          console.warn(
            "[translateMealPlan]",
            member.member_id,
            "day",
            dayIndex,
            "translation failed:",
            err instanceof Error ? err.message : String(err),
          );
          break;
        }
      }
    }
  }

  return {
    plan: { ...plan, members },
    usage: {
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: computeCostUsd(totalIn, totalOut, TRANSLATE_MODEL),
      model: TRANSLATE_MODEL,
    },
  };
}

/**
 * Translate an existing meal_plan row IN PLACE (no new row, status unchanged).
 * Used when a housekeeper is added / her language changes.
 */
export async function runMealPlanTranslation(params: {
  supabase: AnyClient;
  anthropicApiKey: string;
  userId: string;
  mealPlanId: string;
  plan: MealPlan;
  locale: LocaleCode;
}): Promise<void> {
  const { supabase, anthropicApiKey, userId, mealPlanId, plan, locale } = params;
  const startMs = Date.now();
  const { plan: translated, usage } = await translateMealPlan({
    anthropicApiKey,
    plan,
    locale,
    // Persist each day as it lands (today-first) so the maid sees recipes within
    // seconds instead of waiting for all 7 days. The final update below is the
    // complete, last-write snapshot.
    onDayTranslated: async (p) => {
      await supabase.from("meal_plans").update({ plan_data: p }).eq("id", mealPlanId);
    },
  });
  const { error } = await supabase
    .from("meal_plans")
    .update({ plan_data: translated })
    .eq("id", mealPlanId);
  if (error) {
    throw new Error(`Failed to update meal_plan (translate): ${error.message}`);
  }

  // Audit the translation's token spend. A separate plan_generations row (status
  // 'completed' — the only valid value besides started/failed) sharing this
  // plan's meal_plan_id; the weekly rate limit counts DISTINCT meal_plan_id so
  // this row never consumes a generation slot.
  const completedAt = new Date().toISOString();
  const { error: auditError } = await supabase.from("plan_generations").insert({
    user_id: userId,
    meal_plan_id: mealPlanId,
    model: usage.model,
    status: "completed",
    tokens_in: usage.input_tokens,
    tokens_out: usage.output_tokens,
    cost_usd: usage.cost_usd,
    duration_ms: Date.now() - startMs,
    started_at: new Date(startMs).toISOString(),
    completed_at: completedAt,
  });
  if (auditError) {
    // Non-fatal: the translation itself succeeded; only the audit row failed.
    console.error(
      "[runMealPlanTranslation] failed to write translation audit row:",
      auditError.message,
    );
  }
}
