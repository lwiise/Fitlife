import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_MODEL, PLAN_MEMBER_MAX_TOKENS } from "./constants";
import { streamAnthropic, stripMarkdownFence, computeCostUsd } from "./anthropic";
import { buildMemberSystemPrompt } from "./systemPrompt";
import {
  MemberPlanSchema,
  MealPlanSchema,
  type MealPlan,
  type MemberPlan,
} from "./schema";
import { PlanValidationError } from "./errors";
import {
  getBeneficiaries,
  type Beneficiary,
  type PlanPromptContext,
} from "./buildContext";

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

/** Generate one beneficiary's plan, retrying once on a transient failure. */
async function generateOneMember(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
  target: Beneficiary;
  methodologyOverride?: string;
}): Promise<{ plan: MemberPlan; tokensIn: number; tokensOut: number }> {
  const { anthropicApiKey, context, target, methodologyOverride } = params;
  const systemPrompt = buildMemberSystemPrompt(
    context,
    target,
    methodologyOverride,
  );

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, tokensIn, tokensOut, stopReason } = await streamAnthropic({
        apiKey: anthropicApiKey,
        model: PLAN_MODEL,
        maxTokens: PLAN_MEMBER_MAX_TOKENS,
        systemPrompt,
      });

      if (!text.trim()) {
        throw new PlanValidationError(
          `Member ${target.member_id}: empty response`,
          text,
        );
      }
      if (stopReason === "max_tokens") {
        throw new PlanValidationError(
          `Member ${target.member_id} hit max_tokens (${PLAN_MEMBER_MAX_TOKENS})`,
          text,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripMarkdownFence(text));
      } catch (e) {
        throw new PlanValidationError(
          `Member ${target.member_id} JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
          text,
        );
      }

      const result = MemberPlanSchema.safeParse(parsed);
      if (!result.success) {
        throw new PlanValidationError(
          `Member ${target.member_id} failed validation: ${result.error.message.slice(0, 300)}`,
          text,
        );
      }

      // Member id + display name are authoritative from our DB, never the model.
      const plan: MemberPlan = {
        ...result.data,
        member_id: target.member_id,
        member_name_ar: target.member_name_ar,
      };
      return { plan, tokensIn, tokensOut };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Member ${params.target.member_id} generation failed`);
}

/**
 * Generate the full family plan by fanning out one concurrent Anthropic call
 * per beneficiary (mom + non-housekeeper members), then assembling + validating
 * the result. No DB access — callers persist the result.
 */
export async function generateMealPlan(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
  methodologyOverride?: string;
}): Promise<{
  plan: MealPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
}> {
  const { anthropicApiKey, context, methodologyOverride } = params;
  const beneficiaries = getBeneficiaries(context);

  const results = await Promise.all(
    beneficiaries.map((target) =>
      generateOneMember({ anthropicApiKey, context, target, methodologyOverride }),
    ),
  );

  const members = results.map((r) => r.plan);
  const tokensIn = results.reduce((sum, r) => sum + r.tokensIn, 0);
  const tokensOut = results.reduce((sum, r) => sum + r.tokensOut, 0);

  const validated = MealPlanSchema.safeParse({
    week_start_date: nextSaturdayISO(),
    members,
  });
  if (!validated.success) {
    throw new PlanValidationError(
      `Assembled plan failed validation: ${validated.error.message.slice(0, 300)}`,
    );
  }

  return {
    plan: validated.data,
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
  methodologyOverride?: string;
}): Promise<GenerateResult> {
  const { supabase, anthropicApiKey, mealPlanId, context, methodologyOverride } =
    params;
  const startMs = Date.now();

  let plan: MealPlan;
  let usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  try {
    const result = await generateMealPlan({
      anthropicApiKey,
      context,
      methodologyOverride,
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
