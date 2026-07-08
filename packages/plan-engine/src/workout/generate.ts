import type { SupabaseClient } from "@supabase/supabase-js";
import { streamAnthropic, stripMarkdownFence, computeCostUsd } from "../anthropic";
import {
  SKELETON_MODEL,
  DAY_MODEL,
  planModelLabel,
  skeletonMaxTokens,
  dayMaxTokens,
  bigCallTimeoutMs,
} from "../constants";
import { GenerationInFlightError, PlanValidationError } from "../errors";
import { isRetryable, retryWaitMs, MAX_RETRIES } from "../generate";
import { AnthropicCallError } from "../errors";
import type { PlanPromptContext } from "../buildContext";
import {
  WorkoutPlanSchema,
  WorkoutSkeletonSchema,
  MemberWorkoutSchema,
  normalizeWorkoutSkeleton,
  normalizeMemberSessions,
  normalizeExerciseIds,
  type WorkoutPlan,
  type MemberWorkout,
  type WorkoutSkeleton,
} from "./schema";
import {
  WORKOUT_STATIC,
  buildWorkoutSkeletonPrompt,
  buildWorkoutMemberPrompt,
  workoutTrainees,
} from "./systemPrompt";

type AnyClient = SupabaseClient<any, any, any>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Placeholder rows for a workout generation (mirrors createPlanRows):
 * workout_plans 'generating' shell + a plan_generations 'started' lock row
 * with plan_kind='workout'. The composite unique index from 00014 makes the
 * lock authoritative per (user, kind) — a 23505 means another workout run is
 * live: archive our placeholder and surface the busy signal.
 */
export async function createWorkoutPlanRows(
  supabase: AnyClient,
  userId: string,
): Promise<string> {
  const workoutPlanId = crypto.randomUUID();

  const { error: insertPlanError } = await supabase.from("workout_plans").insert({
    id: workoutPlanId,
    user_id: userId,
    status: "generating",
    plan_data: {},
    ai_model: planModelLabel(),
  });
  if (insertPlanError) {
    throw new Error(`Failed to create workout_plan row: ${insertPlanError.message}`);
  }

  const { error: insertGenError } = await supabase.from("plan_generations").insert({
    user_id: userId,
    plan_kind: "workout",
    workout_plan_id: workoutPlanId,
    model: planModelLabel(),
    status: "started",
    started_at: new Date().toISOString(),
  });
  if (insertGenError) {
    if ((insertGenError as { code?: string }).code === "23505") {
      const { error: archiveError } = await supabase
        .from("workout_plans")
        .update({
          status: "archived",
          error_message: "superseded: another workout generation was already in flight",
        })
        .eq("id", workoutPlanId);
      if (archiveError) {
        console.error(
          "[createWorkoutPlanRows] failed to archive raced placeholder",
          archiveError.message,
        );
      }
      throw new GenerationInFlightError();
    }
    await supabase
      .from("workout_plans")
      .update({ status: "failed", error_message: "audit row insert failed" })
      .eq("id", workoutPlanId);
    throw new Error(`Failed to create plan_generations row: ${insertGenError.message}`);
  }

  return workoutPlanId;
}

export interface WorkoutGenerateResult {
  plan: WorkoutPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  missingMembers: string[];
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(stripMarkdownFence(raw)) as T;
  } catch (err) {
    throw new PlanValidationError(`${label}: invalid JSON — ${String(err)}`, raw);
  }
}

/**
 * Two-phase workout generation: one skeleton call (split + named sessions for
 * every opted-in trainee — SKELETON_MODEL because split selection and the
 * pregnancy/injury exclusions are the safety surface), then ONE expansion call
 * per member (a full week ≤6 sessions fits comfortably in a day-slice budget —
 * DAY_MODEL). Sequential; each call is far smaller than a meal day.
 */
export async function generateWorkoutPlan(params: {
  anthropicApiKey: string;
  context: PlanPromptContext;
  weekStartDate: string;
  onMemberDone?: (member: MemberWorkout, done: number, total: number) => Promise<void>;
}): Promise<WorkoutGenerateResult> {
  const { anthropicApiKey, context, weekStartDate, onMemberDone } = params;
  const trainees = workoutTrainees(context);
  if (trainees.length === 0) {
    throw new PlanValidationError("no opted-in workout trainees in context");
  }

  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  // ── Phase 1: skeleton ──
  // Parse + validate INSIDE the retry loop: a malformed/invalid response is
  // re-rolled like any transient failure (a fresh sample usually fixes shape
  // issues), and a shape code can repair — an over-emitted week — is
  // normalized rather than failed.
  const skeletonPrompt = buildWorkoutSkeletonPrompt(context);
  const desiredDaysById = Object.fromEntries(
    trainees.map((t) => [t.member_id, t.profile.desired_days]),
  );
  let skeleton: WorkoutSkeleton | null = null;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await streamAnthropic({
        apiKey: anthropicApiKey,
        model: SKELETON_MODEL,
        maxTokens: skeletonMaxTokens(trainees.length),
        systemStatic: WORKOUT_STATIC,
        systemPrompt: skeletonPrompt,
        timeoutMs: bigCallTimeoutMs(trainees.length, false),
      });
      totalIn += res.tokensIn;
      totalOut += res.tokensOut;
      totalCost += computeCostUsd(res.tokensIn, res.tokensOut, SKELETON_MODEL);

      const parsed = WorkoutSkeletonSchema.safeParse(
        parseJson(res.text, "workout skeleton"),
      );
      if (!parsed.success) {
        throw new PlanValidationError(
          `workout skeleton failed validation: ${parsed.error.message}`,
          res.text,
        );
      }
      skeleton = normalizeWorkoutSkeleton(parsed.data, desiredDaysById);
      break;
    } catch (err) {
      const retryable = isRetryable(err) || err instanceof PlanValidationError;
      if (attempt >= MAX_RETRIES || !retryable) throw err;
      const ra = err instanceof AnthropicCallError ? err.retryAfterMs : undefined;
      await sleep(retryWaitMs(attempt, ra));
    }
  }
  if (!skeleton) throw new PlanValidationError("workout skeleton unavailable");

  // ── Phase 2: per-member weekly expansion ──
  const members: MemberWorkout[] = [];
  const missingMembers: string[] = [];
  let done = 0;

  for (const trainee of trainees) {
    let member: MemberWorkout | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await streamAnthropic({
          apiKey: anthropicApiKey,
          model: DAY_MODEL,
          maxTokens: dayMaxTokens(1, false),
          systemStatic: WORKOUT_STATIC,
          systemPrompt: buildWorkoutMemberPrompt(context, skeleton, trainee.member_id),
          timeoutMs: bigCallTimeoutMs(1, false),
        });
        totalIn += res.tokensIn;
        totalOut += res.tokensOut;
        totalCost += computeCostUsd(res.tokensIn, res.tokensOut, DAY_MODEL);

        const parsed = MemberWorkoutSchema.safeParse(
          parseJson(res.text, `workout member ${trainee.member_id}`),
        );
        if (!parsed.success) {
          throw new PlanValidationError(
            `member workout failed validation: ${parsed.error.message}`,
            res.text,
          );
        }
        const withIds = normalizeExerciseIds({
          ...parsed.data,
          member_id: trainee.member_id,
          weekly_sessions: normalizeMemberSessions(
            parsed.data.weekly_sessions,
            trainee.profile.desired_days,
          ),
        });
        if (withIds.unknownIds.length > 0) {
          // Log-only (mirrors the cookbook deviation guard): an off-catalog
          // id loses its animation, never the run.
          console.warn("[workout-generate] off-catalog exercise_id(s) nulled", {
            member: trainee.member_id,
            ids: withIds.unknownIds,
          });
        }
        member = withIds.member;
        break;
      } catch (err) {
        const retryable = isRetryable(err) || err instanceof PlanValidationError;
        if (attempt >= MAX_RETRIES || !retryable) {
          console.warn(
            "[workout-generate] member failed (omitting)",
            trainee.member_id,
            err instanceof Error ? err.message : String(err),
          );
          break;
        }
        const ra = err instanceof AnthropicCallError ? err.retryAfterMs : undefined;
        await sleep(retryWaitMs(attempt, ra));
      }
    }
    done += 1;
    if (member) {
      members.push(member);
      if (onMemberDone) await onMemberDone(member, done, trainees.length);
    } else {
      missingMembers.push(trainee.member_id);
    }
  }

  if (members.length === 0) {
    throw new PlanValidationError("workout generation produced no valid members");
  }

  const plan: WorkoutPlan = {
    week_start_date: weekStartDate,
    members,
    safety_disclaimer_ar: skeleton.safety_disclaimer_ar,
  };
  const finalParsed = WorkoutPlanSchema.safeParse(plan);
  if (!finalParsed.success) {
    throw new PlanValidationError(
      `assembled workout plan failed validation: ${finalParsed.error.message}`,
    );
  }

  return {
    plan: finalParsed.data,
    usage: { input_tokens: totalIn, output_tokens: totalOut, cost_usd: totalCost },
    missingMembers,
  };
}

/**
 * Full run against Supabase: generate, persist progressively (each finished
 * member updates plan_data with generating:true), terminalize both rows.
 * Mirrors runMealPlanGeneration's status discipline.
 */
export async function runWorkoutPlanGeneration(params: {
  supabase: AnyClient;
  anthropicApiKey: string;
  workoutPlanId: string;
  context: PlanPromptContext;
  weekStartDate: string;
}): Promise<void> {
  const { supabase, anthropicApiKey, workoutPlanId, context, weekStartDate } = params;
  const startMs = Date.now();

  try {
    const doneMembers: MemberWorkout[] = [];
    const result = await generateWorkoutPlan({
      anthropicApiKey,
      context,
      weekStartDate,
      onMemberDone: async (member) => {
        doneMembers.push(member);
        await supabase
          .from("workout_plans")
          .update({
            plan_data: {
              week_start_date: weekStartDate,
              members: doneMembers,
              generating: true,
            },
          })
          .eq("id", workoutPlanId);
      },
    });

    const durationMs = Date.now() - startMs;
    await supabase
      .from("workout_plans")
      .update({
        status: "ready",
        generated_at: new Date().toISOString(),
        plan_data: result.plan,
        ai_input_tokens: result.usage.input_tokens,
        ai_output_tokens: result.usage.output_tokens,
        ai_generation_seconds: Math.round(durationMs / 10) / 100,
        error_message:
          result.missingMembers.length > 0
            ? `partial: members [${result.missingMembers.join(", ")}] failed`
            : null,
      })
      .eq("id", workoutPlanId);

    await supabase
      .from("plan_generations")
      .update({
        status: "completed",
        tokens_in: result.usage.input_tokens,
        tokens_out: result.usage.output_tokens,
        cost_usd: result.usage.cost_usd,
        ai_input_tokens: result.usage.input_tokens,
        ai_output_tokens: result.usage.output_tokens,
        estimated_cost_usd: result.usage.cost_usd,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("workout_plan_id", workoutPlanId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[workout-generate] failed", message);
    await supabase
      .from("workout_plans")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", workoutPlanId);
    await supabase
      .from("plan_generations")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        duration_ms: Date.now() - startMs,
        completed_at: new Date().toISOString(),
      })
      .eq("workout_plan_id", workoutPlanId);
    throw err;
  }
}
