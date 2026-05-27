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
  type MemberPlan,
  type PlanSkeleton,
  type Meal,
  type Day,
} from "./schema";
import { PlanValidationError, AnthropicCallError } from "./errors";
import { getBeneficiaries, type PlanPromptContext } from "./buildContext";
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
  // Called (serialized) after each day completes with the plan-so-far.
  onProgress?: (
    snapshot: MealPlan,
    info: { readyDays: number; totalDays: number },
  ) => Promise<void> | void;
}): Promise<{
  plan: MealPlan;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
}> {
  const { anthropicApiKey, context, existingPlan, onProgress } = params;
  let totalIn = 0;
  let totalOut = 0;

  // The week is anchored to the generation day (carried over on incremental
  // member changes). Day names are computed from this anchor, not the model.
  const weekStart = existingPlan?.week_start_date ?? riyadhTodayISO();

  const beneficiaries = getBeneficiaries(context);
  const beneIds = new Set(beneficiaries.map((b) => b.member_id));
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

  // ── Analyse the prior plan: which members carry over, the family day grid ──
  const seeded = new Map<string, MemberPlan>(); // complete members carried over
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
    const ref = [...existingPlan.members].sort(
      (a, b) => b.days.length - a.days.length,
    )[0];
    for (const d of ref?.days ?? []) {
      familyDishGrid.set(
        d.day_index,
        d.meals.map((m) => ({
          slot: m.slot,
          slot_name_ar: m.slot_name_ar,
          recipe_name_ar: m.recipe_name_ar,
        })),
      );
    }
    const complete = (m: MemberPlan) =>
      familyDayIndices.length > 0 &&
      familyDayIndices.every((di) => {
        const day = m.days.find((d) => d.day_index === di);
        return !!day && day.meals.length > 0;
      });
    for (const m of existingPlan.members) {
      if (beneIds.has(m.member_id) && complete(m)) seeded.set(m.member_id, m);
    }
  }

  const toGenerate = beneficiaries.filter((b) => !seeded.has(b.member_id));

  // ── Fast path: nothing to generate (e.g. a member was removed) ──
  if (toGenerate.length === 0) {
    const members = beneficiaries.map((b) => {
      const m = seeded.get(b.member_id)!;
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
    return { plan, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  }

  // Incremental add/edit: open the plan IMMEDIATELY (before the skeleton call)
  // with the carried-over members intact and the new/edited member as an empty
  // loading placeholder — so the user never sees a full-screen "generating"
  // screen that hides the prior plan while the skeleton runs.
  if (onProgress && seeded.size > 0 && familyDayIndices.length > 0) {
    const preMembers: MemberPlan[] = beneficiaries.map((b) => {
      const s = seeded.get(b.member_id);
      if (s) return { ...s, member_name_ar: nameById.get(b.member_id) ?? s.member_name_ar };
      return {
        member_id: b.member_id,
        member_name_ar: nameById.get(b.member_id) ?? "",
        daily_calories_target: 0,
        macros_target: { protein_g: 0, carbs_g: 0, fat_g: 0 },
        days: familyDayIndices.map((di) => ({
          day_index: di,
          day_name_ar: khaleejiDayName(weekStart, di),
          meals: [],
          day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        })),
      };
    });
    const preShell: MealPlan = {
      week_start_date: weekStart,
      members: preMembers,
      methodology_notes_ar: existingPlan?.methodology_notes_ar,
      safety_disclaimer_ar: existingPlan?.safety_disclaimer_ar,
      days_total: familyDayIndices.length,
      generating: true,
    };
    await Promise.resolve(
      onProgress(preShell, { readyDays: 0, totalDays: familyDayIndices.length }),
    ).catch((e) => console.error("[plan-generate] pre-skeleton onProgress failed", e));
  }

  // ── Phase 1: skeleton for the members we need to generate ──
  const targetMemberIds = toGenerate.map((b) => b.member_id);
  const sk = await streamAnthropic({
    apiKey: anthropicApiKey,
    model: PLAN_MODEL,
    maxTokens: SKELETON_MAX_TOKENS,
    systemStatic: STATIC_SYSTEM,
    systemPrompt: buildSkeletonPrompt(context, targetMemberIds),
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

  // Align new members to the family's existing dishes (same dish each day).
  const aligned = familyDishGrid.size > 0;
  const workingSkeleton: PlanSkeleton = {
    ...skeleton,
    members: skeleton.members.map((sm) => ({
      ...sm,
      days: dayIndices.map((di) => ({
        day_index: di,
        day_name_ar: dayNameByIndex.get(di)!,
        meals: aligned
          ? (familyDishGrid.get(di) ??
            sm.days.find((d) => d.day_index === di)?.meals ??
            [])
          : (sm.days.find((d) => d.day_index === di)?.meals ?? []),
      })),
    })),
  };

  // ── Assembly: seed complete members, shell the rest ──
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
    const seededMember = seeded.get(b.member_id);
    if (seededMember) {
      for (const d of seededMember.days) dmap.set(d.day_index, d);
      targetsById.set(b.member_id, {
        primary_goal: seededMember.primary_goal,
        daily_calories_target: seededMember.daily_calories_target,
        macros_target: seededMember.macros_target,
      });
    } else {
      for (const di of dayIndices)
        dmap.set(di, {
          day_index: di,
          day_name_ar: dayNameByIndex.get(di)!,
          meals: [],
          day_total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        });
      const skM = skeletonById.get(b.member_id);
      targetsById.set(b.member_id, {
        primary_goal: skM?.primary_goal,
        daily_calories_target: skM?.daily_calories_target ?? 0,
        macros_target: skM?.macros_target ?? {
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        },
      });
    }
    daysByMember.set(b.member_id, dmap);
  }
  const done = new Set<number>(); // toGenerate days expanded successfully

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
  });

  // Serialize onProgress writes.
  let progressTail: Promise<void> = Promise.resolve();
  const emit = () => {
    if (!onProgress) return;
    const snap = snapshot(done.size < totalDays);
    const readyDays = done.size;
    progressTail = progressTail.then(() =>
      Promise.resolve(onProgress(snap, { readyDays, totalDays })).catch((e) =>
        console.error("[plan-generate] onProgress failed", e),
      ),
    );
  };

  // Open the plan immediately: existing members complete, new members loading.
  emit();

  // ── Phase 2: expand each day sequentially (toGenerate members only) ──
  await mapWithConcurrency(dayIndices, DAY_CONCURRENCY, async (dayIndex) => {
    const prompt = buildDayPrompt(
      context,
      workingSkeleton,
      dayIndex,
      dayNameByIndex.get(dayIndex),
    );
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
        totalIn += res.tokensIn;
        totalOut += res.tokensOut;
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
        const slice = r.data;
        for (const sm of workingSkeleton.members) {
          const sliceMember = slice.members.find(
            (m) => m.member_id === sm.member_id,
          );
          const meals = sliceMember?.meals ?? [];
          // Stamp the translation locale in code (don't trust the model to echo it).
          if (context.housekeeper_locale) {
            for (const meal of meals) {
              if (meal.prep_steps_translated && meal.prep_steps_translated.length > 0) {
                meal.prep_steps_translated_locale = context.housekeeper_locale;
              }
            }
          }
          daysByMember.get(sm.member_id)!.set(dayIndex, {
            day_index: dayIndex,
            day_name_ar: dayNameByIndex.get(dayIndex) ?? `اليوم ${dayIndex + 1}`,
            meals,
            day_total: sumDayTotal(meals),
          });
        }
        done.add(dayIndex);
        emit();
        return;
      } catch (err) {
        if (isRetryable(err) && attempt < 2) {
          attempt++;
          await sleep(800 * attempt);
          continue;
        }
        console.error(
          "[plan-generate] day failed (omitting)",
          dayIndex,
          err instanceof Error ? err.message : String(err),
        );
        emit();
        return;
      }
    }
  });

  await progressTail;

  // Fatal only if there were no carried-over members AND nothing generated.
  if (done.size === 0 && seeded.size === 0) {
    throw new PlanValidationError(`All ${totalDays} day generations failed`);
  }

  // ── Final assembled MealPlan ──
  const result = MealPlanSchema.safeParse(snapshot(false));
  if (!result.success)
    throw new PlanValidationError(
      `Assembled plan failed validation: ${result.error.message.slice(0, 400)}`,
    );
  const plan: MealPlan = result.data;

  // Non-fatal numeric guards (skip seeded members — already validated).
  for (const memberPlan of plan.members) {
    if (seeded.has(memberPlan.member_id)) continue;
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
  existingPlan?: MealPlan | null;
}): Promise<GenerateResult> {
  const { supabase, anthropicApiKey, mealPlanId, context, existingPlan } = params;
  const startMs = Date.now();

  let plan: MealPlan;
  let usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  try {
    const result = await generateMealPlan({
      anthropicApiKey,
      context,
      existingPlan,
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
