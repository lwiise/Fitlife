import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_MODEL, PLAN_MAX_TOKENS } from "./constants";
import { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
import { buildSystemPrompt } from "./systemPrompt";
import { MealPlanSchema, type MealPlan } from "./schema";
import { PlanValidationError } from "./errors";
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

/**
 * Generate the WHOLE family plan in a single coordinated Anthropic call
 * (Sara's family-as-unit methodology — shared base recipes + per-member
 * portions). Parses, validates against the schema + Sara's safety/macro
 * guards, and returns. No DB access — callers persist the result.
 */
export async function generateMealPlan(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
}): Promise<{
  plan: MealPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
}> {
  const { anthropicApiKey, context } = params;

  const { text, tokensIn, tokensOut, stopReason } = await streamAnthropic({
    apiKey: anthropicApiKey,
    model: PLAN_MODEL,
    maxTokens: PLAN_MAX_TOKENS,
    systemPrompt: buildSystemPrompt(context),
  });

  if (!text.trim()) {
    throw new PlanValidationError("Empty response from Anthropic", text);
  }
  if (stopReason === "max_tokens") {
    throw new PlanValidationError(
      `Plan hit max_tokens (${PLAN_MAX_TOKENS}); household too large for the cap`,
      text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch (e) {
    throw new PlanValidationError(
      `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
      text,
    );
  }

  const result = MealPlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new PlanValidationError(
      `Plan failed validation: ${result.error.message.slice(0, 400)}`,
      text,
    );
  }

  // Member id + display name are authoritative from our DB, never the model.
  const beneficiaries = getBeneficiaries(context);
  const nameById = new Map(
    beneficiaries.map((b) => [b.member_id, b.member_name_ar]),
  );
  // Children are portion-based (food pyramid), never calorie-floored. Mark them
  // by member_type OR age<18 — family members carry a precomputed is_child flag.
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

  const plan: MealPlan = {
    ...result.data,
    week_start_date: nextSaturdayISO(),
    members: result.data.members.map((m) => ({
      ...m,
      member_name_ar: nameById.get(m.member_id) ?? m.member_name_ar,
    })),
  };

  // ── Sara's safety guards (post-validation) ──
  for (const memberPlan of plan.members) {
    const isChild = isChildById.get(memberPlan.member_id) ?? false;
    if (!isChild && memberPlan.daily_calories_target < 1400) {
      throw new PlanValidationError(
        `Calories ${memberPlan.daily_calories_target} below the 1400 safety floor for ${memberPlan.member_id}`,
        text,
      );
    }
    if (
      !isChild &&
      memberPlan.daily_calories_target >= 1400 &&
      memberPlan.daily_calories_target < 1600
    ) {
      console.warn(
        "[plan-generate] calories below 1600 for",
        memberPlan.member_id,
        ":",
        memberPlan.daily_calories_target,
      );
    }

    const { protein_g, carbs_g, fat_g } = memberPlan.macros_target;
    const calcKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
    const drift =
      Math.abs(calcKcal - memberPlan.daily_calories_target) /
      memberPlan.daily_calories_target;
    if (drift > 0.1) {
      throw new PlanValidationError(
        `Macro totals (${Math.round(calcKcal)} kcal) drift >10% from target (${memberPlan.daily_calories_target}) for ${memberPlan.member_id}`,
        text,
      );
    }
  }

  return {
    plan,
    usage: {
      input_tokens: tokensIn,
      output_tokens: tokensOut,
      cost_usd: computeCostUsd(tokensIn, tokensOut),
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
