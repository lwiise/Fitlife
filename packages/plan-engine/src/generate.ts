import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_MODEL,
  SKELETON_MAX_TOKENS,
  DAY_MAX_TOKENS,
  DAY_CONCURRENCY,
} from "./constants";
import { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
import {
  STATIC_SYSTEM,
  buildSkeletonPrompt,
  buildDayPrompt,
} from "./systemPrompt";
import {
  MealPlanSchema,
  PlanSkeletonSchema,
  DaySliceSchema,
  type MealPlan,
  type PlanSkeleton,
  type Meal,
} from "./schema";
import { PlanValidationError, AnthropicCallError } from "./errors";
import { getBeneficiaries, type PlanPromptContext } from "./buildContext";

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

/** ISO date (YYYY-MM-DD) of the upcoming Saturday — the Gulf week start. */
function nextSaturdayISO(): string {
  const now = new Date();
  const daysUntilSat = (6 - now.getUTCDay() + 7) % 7;
  const sat = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSat,
    ),
  );
  return sat.toISOString().slice(0, 10);
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
    ai_model: PLAN_MODEL,
  });
  if (insertMealError) {
    throw new Error(`Failed to create meal_plan row: ${insertMealError.message}`);
  }

  const { error: insertGenError } = await supabase
    .from("plan_generations")
    .insert({
      user_id: userId,
      meal_plan_id: mealPlanId,
      model: PLAN_MODEL,
      status: "started",
      started_at: new Date().toISOString(),
    });
  if (insertGenError) {
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

/** A retryable Anthropic error (429 or 5xx, or a transient stream error). */
function isRetryable(err: unknown): boolean {
  return (
    err instanceof AnthropicCallError &&
    (/Anthropic API (429|5\d\d)/.test(err.message) ||
      /stream error/.test(err.message))
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/**
 * Generate the whole family plan in two phases to break the single-call time
 * ceiling: (1) a small "skeleton" call sets per-member targets + a week of dish
 * NAMES (variety + shared-recipe coordination decided once); (2) each day is
 * expanded into full recipes in PARALLEL (capped + retried). Wall-clock ≈ one
 * day regardless of week/family size. No DB access — callers persist the result.
 */
export async function generateMealPlan(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
}): Promise<{
  plan: MealPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
}> {
  const { anthropicApiKey, context } = params;
  let totalIn = 0;
  let totalOut = 0;

  // ── Phase 1: skeleton (targets + dish names) ──
  const sk = await streamAnthropic({
    apiKey: anthropicApiKey,
    model: PLAN_MODEL,
    maxTokens: SKELETON_MAX_TOKENS,
    systemStatic: STATIC_SYSTEM,
    systemPrompt: buildSkeletonPrompt(context),
  });
  totalIn += sk.tokensIn;
  totalOut += sk.tokensOut;
  if (!sk.text.trim())
    throw new PlanValidationError("Empty skeleton from Anthropic", sk.text);
  if (sk.stopReason === "max_tokens")
    throw new PlanValidationError(
      `Skeleton hit max_tokens (${SKELETON_MAX_TOKENS})`,
      sk.text,
    );

  let skeleton: PlanSkeleton;
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

  const dayIndices = Array.from(
    new Set(skeleton.members.flatMap((m) => m.days.map((d) => d.day_index))),
  ).sort((a, b) => a - b);

  // ── Phase 2: expand each day in parallel ──
  const dayUsages: { tokensIn: number; tokensOut: number }[] = [];
  const slices = await mapWithConcurrency(
    dayIndices,
    DAY_CONCURRENCY,
    async (dayIndex) => {
      const prompt = buildDayPrompt(context, skeleton, dayIndex);
      let attempt = 0;
      for (;;) {
        try {
          const res = await streamAnthropic({
            apiKey: anthropicApiKey,
            model: PLAN_MODEL,
            maxTokens: DAY_MAX_TOKENS,
            systemStatic: STATIC_SYSTEM,
            systemPrompt: prompt,
          });
          dayUsages.push({ tokensIn: res.tokensIn, tokensOut: res.tokensOut });
          if (res.stopReason === "max_tokens")
            throw new PlanValidationError(
              `Day ${dayIndex} hit max_tokens (${DAY_MAX_TOKENS})`,
              res.text,
            );
          const parsed = JSON.parse(stripMarkdownFence(res.text));
          const r = DaySliceSchema.safeParse(parsed);
          if (!r.success)
            throw new PlanValidationError(
              `Day ${dayIndex} failed validation: ${r.error.message.slice(0, 300)}`,
              res.text,
            );
          return r.data;
        } catch (err) {
          if (isRetryable(err) && attempt < 2) {
            attempt++;
            await sleep(800 * attempt);
            continue;
          }
          throw err;
        }
      }
    },
  );
  for (const u of dayUsages) {
    totalIn += u.tokensIn;
    totalOut += u.tokensOut;
  }

  // ── Assemble into a MealPlan ──
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
  const sliceByDay = new Map(slices.map((s) => [s.day_index, s]));
  const dayNameByIndex = new Map(
    (skeleton.members[0]?.days ?? []).map((d) => [d.day_index, d.day_name_ar]),
  );

  const members = skeleton.members.map((sm) => {
    const days = dayIndices.map((di) => {
      const slice = sliceByDay.get(di);
      const sliceMember = slice?.members.find(
        (m) => m.member_id === sm.member_id,
      );
      const meals = sliceMember?.meals ?? [];
      return {
        day_index: di,
        day_name_ar:
          slice?.day_name_ar || dayNameByIndex.get(di) || `اليوم ${di + 1}`,
        meals,
        day_total: sumDayTotal(meals),
      };
    });
    return {
      member_id: sm.member_id,
      member_name_ar: nameById.get(sm.member_id) ?? sm.member_name_ar ?? "",
      primary_goal: sm.primary_goal,
      daily_calories_target: sm.daily_calories_target,
      macros_target: sm.macros_target,
      days,
    };
  });

  const result = MealPlanSchema.safeParse({
    week_start_date: nextSaturdayISO(),
    members,
    methodology_notes_ar: skeleton.methodology_notes_ar,
    safety_disclaimer_ar: skeleton.safety_disclaimer_ar,
  });
  if (!result.success)
    throw new PlanValidationError(
      `Assembled plan failed validation: ${result.error.message.slice(0, 400)}`,
    );
  const plan: MealPlan = result.data;

  // Non-fatal numeric guards (targets come from the skeleton; drift is rare now).
  for (const memberPlan of plan.members) {
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

  return {
    plan,
    usage: {
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: computeCostUsd(totalIn, totalOut),
    },
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
}): Promise<GenerateResult> {
  const { supabase, anthropicApiKey, mealPlanId, context } = params;
  const startMs = Date.now();

  let plan: MealPlan;
  let usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  try {
    const result = await generateMealPlan({
      anthropicApiKey,
      context,
    });
    plan = result.plan;
    usage = result.usage;
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

  const durationMs = Date.now() - startMs;
  const generatedAt = new Date().toISOString();

  const { error: updateMealError } = await supabase
    .from("meal_plans")
    .update({
      status: "ready",
      plan_data: plan,
      generated_at: generatedAt,
      ai_input_tokens: usage.input_tokens,
      ai_output_tokens: usage.output_tokens,
      ai_generation_seconds: durationMs / 1000,
    })
    .eq("id", mealPlanId);

  if (updateMealError) {
    throw new Error(`Failed to update meal_plan: ${updateMealError.message}`);
  }

  const { error: updateGenError } = await supabase
    .from("plan_generations")
    .update({
      status: "completed",
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens,
      cost_usd: usage.cost_usd,
      duration_ms: durationMs,
      completed_at: generatedAt,
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
