import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic/client";
import {
  PLAN_MODEL,
  PLAN_MAX_TOKENS,
  PRICING_USD_PER_MTOK,
} from "@/lib/anthropic/constants";
import { buildPromptContext } from "./buildPromptContext";
import { buildSystemPrompt } from "./systemPrompt";
import { MealPlanSchema, type MealPlan } from "./schema";
import { AnthropicCallError, PlanValidationError } from "./errors";

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

function stripMarkdownFence(text: string): string {
  // Strip optional ```json ... ``` or ``` ... ``` wrapper.
  const fence = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
  if (fence && fence[1]) return fence[1];
  return text.trim();
}

function computeCostUsd(tokensIn: number, tokensOut: number): number {
  const cost =
    (tokensIn / 1_000_000) * PRICING_USD_PER_MTOK.input +
    (tokensOut / 1_000_000) * PRICING_USD_PER_MTOK.output;
  // Round to 6 decimals (matches plan_generations.cost_usd numeric(10, 6))
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Orchestrates a full meal-plan generation:
 *  1. Build context (throws if onboarding incomplete or medical gate trips)
 *  2. Insert meal_plans + plan_generations rows (status started/generating)
 *  3. Call Anthropic
 *  4. Strip fences, JSON.parse, Zod-validate
 *  5. Update both rows with success (ready/completed) or failure
 *
 * Throws typed errors that the route handler maps to HTTP statuses.
 */
export async function generateMealPlan(
  userId: string,
  options?: { methodologyOverride?: string },
): Promise<GenerateResult> {
  const supabase = await createClient();

  const context = await buildPromptContext(userId);

  const mealPlanId = crypto.randomUUID();
  const startMs = Date.now();

  // 1. Create the placeholder rows so audit captures even failures.
  const mealPlanRow = {
    id: mealPlanId,
    user_id: userId,
    status: "generating",
    plan_data: {},
    ai_model: PLAN_MODEL,
  };
  const { error: insertMealError } = await supabase
    .from("meal_plans")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .insert(mealPlanRow);

  if (insertMealError) {
    throw new Error(`Failed to create meal_plan row: ${insertMealError.message}`);
  }

  const planGenerationRow = {
    user_id: userId,
    meal_plan_id: mealPlanId,
    model: PLAN_MODEL,
    status: "started",
    started_at: new Date().toISOString(),
  };
  const { error: insertGenError } = await supabase
    .from("plan_generations")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .insert(planGenerationRow);

  if (insertGenError) {
    // Best-effort cleanup of the meal_plan row, then bail.
    await supabase
      .from("meal_plans")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({ status: "failed", error_message: "audit row insert failed" })
      .eq("id", mealPlanId);
    throw new Error(`Failed to create plan_generations row: ${insertGenError.message}`);
  }

  // 2. Build the prompt (substitute methodology override for the test route).
  let systemPrompt = buildSystemPrompt(context);
  if (options?.methodologyOverride) {
    systemPrompt = systemPrompt.replace(
      "{{METHODOLOGY_PLACEHOLDER}}",
      options.methodologyOverride,
    );
  }

  let tokensIn = 0;
  let tokensOut = 0;
  let validated: MealPlan | null = null;
  let rawText = "";

  try {
    // 3. Call Anthropic.
    const client = getAnthropicClient();
    let response;
    try {
      response = await client.messages.create({
        model: PLAN_MODEL,
        max_tokens: PLAN_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: "أنشئي الخطة الآن." }],
      });
    } catch (err) {
      throw new AnthropicCallError(
        err instanceof Error ? err.message : "Anthropic API call failed",
        err,
      );
    }

    tokensIn = response.usage.input_tokens;
    tokensOut = response.usage.output_tokens;

    // 4. Extract text from content blocks.
    rawText = response.content
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!rawText.trim()) {
      throw new PlanValidationError("Empty response from Anthropic", rawText);
    }

    // 5. Strip fences, JSON.parse, Zod validate.
    const cleaned = stripMarkdownFence(rawText);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new PlanValidationError(
        `Failed to JSON.parse response: ${err instanceof Error ? err.message : String(err)}`,
        rawText,
      );
    }

    const result = MealPlanSchema.safeParse(parsed);
    if (!result.success) {
      throw new PlanValidationError(
        `Zod validation failed: ${result.error.message}`,
        rawText,
      );
    }
    validated = result.data;
  } catch (err) {
    // Update audit rows with failure state, then re-throw.
    const durationMs = Date.now() - startMs;
    const costUsd = computeCostUsd(tokensIn, tokensOut);
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from("plan_generations")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({
        status: "failed",
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: costUsd,
        duration_ms: durationMs,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("meal_plan_id", mealPlanId);

    await supabase
      .from("meal_plans")
      // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", mealPlanId);

    throw err;
  }

  // 6. Success path — write everything.
  const durationMs = Date.now() - startMs;
  const costUsd = computeCostUsd(tokensIn, tokensOut);
  const generatedAt = new Date().toISOString();

  const { error: updateMealError } = await supabase
    .from("meal_plans")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({
      status: "ready",
      plan_data: validated,
      generated_at: generatedAt,
      ai_input_tokens: tokensIn,
      ai_output_tokens: tokensOut,
      ai_generation_seconds: durationMs / 1000,
    })
    .eq("id", mealPlanId);

  if (updateMealError) {
    throw new Error(`Failed to update meal_plan: ${updateMealError.message}`);
  }

  const { error: updateGenError } = await supabase
    .from("plan_generations")
    // @ts-expect-error postgrest-js generic resolves to `never`; runtime is fine.
    .update({
      status: "completed",
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      duration_ms: durationMs,
      completed_at: generatedAt,
    })
    .eq("meal_plan_id", mealPlanId);

  if (updateGenError) {
    // Plan is already in 'ready' state; just log the audit-update failure.
    console.error("[generateMealPlan] failed to update plan_generations audit row:", updateGenError);
  }

  return {
    plan: validated,
    mealPlanId,
    usage: {
      input_tokens: tokensIn,
      output_tokens: tokensOut,
      cost_usd: costUsd,
      duration_ms: durationMs,
    },
  };
}
