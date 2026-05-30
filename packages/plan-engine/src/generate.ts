import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_MODEL,
  SKELETON_MAX_TOKENS,
  DAY_MAX_TOKENS,
  DAY_CONCURRENCY,
  TRANSLATE_CONCURRENCY,
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
  type LocaleCode,
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

/**
 * A retryable Anthropic error: 429 (rate limit), 529 (overloaded), any 5xx, or a
 * transient stream error. 529 is matched both explicitly and via the 5xx branch.
 */
function isRetryable(err: unknown): boolean {
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
const MAX_RETRIES = 3;
function backoffMs(attempt: number): number {
  const base = 800 * 2 ** (attempt - 1); // 800, 1600, 3200
  return base + Math.floor(Math.random() * 400); // jitter avoids thundering herd
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
}> {
  const { anthropicApiKey, context, existingPlan, independentRegen, onProgress } = params;
  let totalIn = 0;
  let totalOut = 0;

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
  // A member is complete iff it carried every family day. Fresh plan (no prior) →
  // everyone generates. Concrete missing-day lists are derived later, once the
  // day grid is known (it comes from the skeleton on a from-scratch plan).
  const isComplete = (b: { member_id: string }) =>
    existingPlan != null &&
    familyDayIndices.length > 0 &&
    familyDayIndices.every((di) => carriedDays.get(b.member_id)!.has(di));
  const membersToGenerate = beneficiaries.filter((b) => !isComplete(b));

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
    const sk = await streamAnthropic({
      apiKey: anthropicApiKey,
      model: PLAN_MODEL,
      maxTokens: SKELETON_MAX_TOKENS,
      systemStatic: STATIC_SYSTEM,
      systemPrompt: buildSkeletonPrompt(
        context,
        needsSkeleton.map((b) => b.member_id),
      ),
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
  const aligned = familyDishGrid.size > 0 && !independentRegen;
  const workingSkeleton: PlanSkeleton = {
    ...skeleton,
    members: beneficiaries
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
        return {
          member_id: b.member_id,
          ...targets,
          days: dayIndices.map((di) => ({
            day_index: di,
            day_name_ar: dayNameByIndex.get(di)!,
            meals: aligned
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
    beneficiaries.some((b) => missingByMember.get(b.member_id)!.includes(di)),
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
  });

  // Serialize onProgress writes.
  let progressTail: Promise<void> = Promise.resolve();
  const emit = () => {
    if (!onProgress) return;
    const snap = snapshot(done.size < genDayCount);
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
  await mapWithConcurrency(daysToGenerate, DAY_CONCURRENCY, async (dayIndex) => {
    const dayMemberIds = new Set(
      beneficiaries
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
        for (const sm of daySkeleton.members) {
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
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          attempt++;
          await sleep(backoffMs(attempt));
          continue;
        }
        console.error(
          "[plan-generate] day failed (omitting)",
          dayIndex,
          err instanceof Error ? err.message : String(err),
        );
        failedDays.add(dayIndex);
        emit();
        return;
      }
    }
  });

  await progressTail;

  // Fatal only if nothing was carried over AND nothing generated.
  const nothingCarried = beneficiaries.every(
    (b) => carriedDays.get(b.member_id)!.size === 0,
  );
  if (done.size === 0 && nothingCarried) {
    throw new PlanValidationError(`All ${genDayCount} day generations failed`);
  }

  // ── Final assembled MealPlan ──
  const result = MealPlanSchema.safeParse(snapshot(false));
  if (!result.success)
    throw new PlanValidationError(
      `Assembled plan failed validation: ${result.error.message.slice(0, 400)}`,
    );
  const plan: MealPlan = result.data;

  // Carry-over invariant (log-only tripwire): each member's CARRIED days must be
  // byte-identical to the prior plan — adding a member or filling one member's
  // gap must never rewrite another member's finished days. Carried cells are
  // placed verbatim and never touched by the generation loop, so this should
  // never fire; if it ever does, a regression started rewriting finished days.
  const dayFingerprint = (d: Day) => JSON.stringify(d);
  for (const [memberId, carried] of carriedDays) {
    if (carried.size === 0) continue;
    const out = plan.members.find((m) => m.member_id === memberId);
    for (const [di, original] of carried) {
      const outDay = out?.days.find((d) => d.day_index === di);
      if (!outDay || dayFingerprint(outDay) !== dayFingerprint(original)) {
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
      cost_usd: computeCostUsd(totalIn, totalOut, PLAN_MODEL),
    },
    missingDays: [...failedDays].sort((a, b) => a - b),
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
}): Promise<GenerateResult> {
  const { supabase, anthropicApiKey, mealPlanId, context, existingPlan, independentRegen } = params;
  const startMs = Date.now();

  let plan: MealPlan;
  let usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  let missingDays: number[] = [];
  try {
    const result = await generateMealPlan({
      anthropicApiKey,
      context,
      existingPlan,
      independentRegen,
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
    if (endLocale && needsTranslate) {
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
    missingDays.length > 0 ? `partial: days [${missingDays.join(", ")}] failed` : null;
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

  await mapWithConcurrency(order, TRANSLATE_CONCURRENCY, async (dayIndex) => {
    const refs: Meal[] = [];
    for (const m of members) {
      const day = m.days.find((d) => d.day_index === dayIndex);
      if (!day) continue;
      for (const meal of day.meals) {
        const alreadyDone =
          meal.prep_steps_translated_locale === locale &&
          !!meal.prep_steps_translated?.length;
        if (!alreadyDone) refs.push(meal);
      }
    }
    if (refs.length === 0) return;

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
          model: PLAN_MODEL,
          maxTokens: DAY_MAX_TOKENS,
          systemPrompt: buildTranslatePrompt(items, locale),
          userMessage: "ترجمي الآن.",
        });
        totalIn += res.tokensIn;
        totalOut += res.tokensOut;
        if (res.stopReason === "max_tokens")
          throw new PlanValidationError(
            `Translate day ${dayIndex} hit max_tokens`,
            res.text,
          );
        const parsed = TranslateOutSchema.safeParse(
          JSON.parse(stripMarkdownFence(res.text)),
        );
        if (!parsed.success)
          throw new PlanValidationError(
            `Translate day ${dayIndex} failed validation: ${parsed.error.message.slice(0, 200)}`,
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
        // Emit a full snapshot so the caller can persist progressively. `members`
        // is the shared working array, so this includes every day done so far →
        // writes are last-write-wins safe even when days finish concurrently.
        // Non-fatal: a failed persist must not abort the translation pass.
        try {
          await onDayTranslated?.({ ...plan, members });
        } catch (persistErr) {
          console.warn(
            "[translateMealPlan] day",
            dayIndex,
            "progressive persist failed:",
            persistErr instanceof Error ? persistErr.message : String(persistErr),
          );
        }
        return;
      } catch (err) {
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          attempt++;
          await sleep(backoffMs(attempt));
          continue;
        }
        // Non-fatal: leave this day untranslated (maid view falls back to Arabic).
        console.warn(
          "[translateMealPlan] day",
          dayIndex,
          "translation failed:",
          err instanceof Error ? err.message : String(err),
        );
        return;
      }
    }
  });

  // ── Transliterate member names into the locale (one call, non-fatal) ──
  const nameTodo = members.filter(
    (m) => m.member_name_translated_locale !== locale,
  );
  if (nameTodo.length > 0) {
    const items = nameTodo.map((m, i) => ({ i, name_ar: m.member_name_ar }));
    let attempt = 0;
    for (;;) {
      try {
        const res = await streamAnthropic({
          apiKey: anthropicApiKey,
          model: PLAN_MODEL,
          maxTokens: DAY_MAX_TOKENS,
          systemPrompt: buildNameTranslatePrompt(items, locale),
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
        for (const out of parsed.data) {
          const member = nameTodo[out.i];
          if (!member) continue;
          member.member_name_translated = out.name;
          member.member_name_translated_locale = locale;
        }
        break;
      } catch (err) {
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          attempt++;
          await sleep(backoffMs(attempt));
          continue;
        }
        // Non-fatal: maid view falls back to the Arabic name.
        console.warn(
          "[translateMealPlan] name translation failed:",
          err instanceof Error ? err.message : String(err),
        );
        break;
      }
    }
  }

  return {
    plan: { ...plan, members },
    usage: {
      input_tokens: totalIn,
      output_tokens: totalOut,
      cost_usd: computeCostUsd(totalIn, totalOut, PLAN_MODEL),
      model: PLAN_MODEL,
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
