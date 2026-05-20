import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_MODEL,
  PLAN_MAX_TOKENS,
  PRICING_USD_PER_MTOK,
} from "./constants";

// Accepts any Supabase client shape (cookie-typed or service-role admin).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;
import { buildSystemPrompt } from "./systemPrompt";
import { MealPlanSchema, type MealPlan } from "./schema";
import { AnthropicCallError, PlanValidationError } from "./errors";
import type { PlanPromptContext } from "./buildContext";

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
  const fence = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
  if (fence && fence[1]) return fence[1];
  return text.trim();
}

function computeCostUsd(tokensIn: number, tokensOut: number): number {
  const cost =
    (tokensIn / 1_000_000) * PRICING_USD_PER_MTOK.input +
    (tokensOut / 1_000_000) * PRICING_USD_PER_MTOK.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
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
 * Run the actual Anthropic generation for an already-created meal_plan row,
 * validate the output, and update both rows (ready/completed or failed).
 *
 * Client + key are injected so this runs unchanged in a request (cookie client)
 * or a Netlify background function (service-role client).
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

  let systemPrompt = buildSystemPrompt(context);
  if (methodologyOverride) {
    systemPrompt = systemPrompt.replace(
      "{{METHODOLOGY_PLACEHOLDER}}",
      methodologyOverride,
    );
  }

  let tokensIn = 0;
  let tokensOut = 0;
  let validated: MealPlan | null = null;
  let rawText = "";

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    let response;
    try {
      response = await anthropic.messages.create({
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
    rawText = response.content
      .filter(
        (block): block is Extract<typeof block, { type: "text" }> =>
          block.type === "text",
      )
      .map((block) => block.text)
      .join("\n");

    if (!rawText.trim()) {
      throw new PlanValidationError("Empty response from Anthropic", rawText);
    }

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
    const durationMs = Date.now() - startMs;
    const costUsd = computeCostUsd(tokensIn, tokensOut);
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from("plan_generations")
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
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", mealPlanId);

    throw err;
  }

  const durationMs = Date.now() - startMs;
  const costUsd = computeCostUsd(tokensIn, tokensOut);
  const generatedAt = new Date().toISOString();

  const { error: updateMealError } = await supabase
    .from("meal_plans")
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
    console.error(
      "[runMealPlanGeneration] failed to update plan_generations audit row:",
      updateGenError,
    );
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
