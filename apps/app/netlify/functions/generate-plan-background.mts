// Netlify background function (15-min budget) for AI meal-plan generation.
//
// Bundle-safety: zip-it-and-ship-it (esbuild) chokes on @supabase/supabase-js
// (optional native/realtime deps), which crashed this function at cold-start
// import time. So we talk to Supabase over plain `fetch` (PostgREST) and import
// only the PURE, fetch-based engine generator (no SDK) — its transitive deps are
// just zod + pure code, which always bundle. The generation logic (per-member
// parallel calls, system prompt, schema) stays the single source of truth in
// @fitlife/plan-engine; the relative path lets esbuild inline it.

import {
  generateMealPlan,
  translateMealPlan,
  hasPendingGeneration,
} from "../../../../packages/plan-engine/src/generate";
import { MEMBER_GEN_MAX_ATTEMPTS } from "../../../../packages/plan-engine/src/constants";
import { LOCALE_CODES } from "../../../../packages/plan-engine/src/schema";
import type { MealPlan, LocaleCode } from "../../../../packages/plan-engine/src/schema";
import type {
  PlanPromptContext,
  PlanPromptContextMember,
} from "../../../../packages/plan-engine/src/buildContext";

type Activity =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active"
  | null;

// ─── Supabase PostgREST over fetch (service-role) ──────────────────────────
function sbHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
}

async function sbSelectOne(
  base: string,
  serviceKey: string,
  table: string,
  query: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: sbHeaders(serviceKey),
  });
  if (!res.ok) throw new Error(`PostgREST select ${table} → ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function sbSelectMany(
  base: string,
  serviceKey: string,
  table: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: sbHeaders(serviceKey),
  });
  if (!res.ok) throw new Error(`PostgREST select ${table} → ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

async function sbUpdate(
  base: string,
  serviceKey: string,
  table: string,
  filter: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...sbHeaders(serviceKey), prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostgREST update ${table} → ${res.status} ${text}`);
  }
}

async function sbInsert(
  base: string,
  serviceKey: string,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders(serviceKey), prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostgREST insert ${table} → ${res.status} ${text}`);
  }
}

// ─── Context shaping (mirror of buildContext, but fed by PostgREST rows) ────
function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}
function arabicNumber(n: number): string {
  return new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);
}
function pluralizeAr(c: number, s: string, d: string, p: string) {
  if (c === 1) return s;
  if (c === 2) return d;
  return p;
}
function buildCompositionSummary(members: PlanPromptContextMember[]): string {
  const partners = members.filter((m) => m.role === "dad");
  const kids = members.filter((m) => m.role === "son" || m.role === "daughter");
  const housekeepers = members.filter((m) => m.role === "housekeeper");
  const total = 1 + partners.length + kids.length;
  const parts: string[] = [
    `عائلة من ${arabicNumber(total)} ${pluralizeAr(total, "فرد", "فردين", "أفراد")}: الأم`,
  ];
  if (partners.length > 0) parts.push("الأب");
  if (kids.length > 0) {
    const ages = kids.map((k) => k.age).filter((a): a is number => a !== null);
    if (ages.length === kids.length) {
      parts.push(
        `و${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")} (${ages.map((a) => `${arabicNumber(a)} سنة`).join("، ")})`,
      );
    } else {
      parts.push(
        `و${arabicNumber(kids.length)} ${pluralizeAr(kids.length, "طفل", "طفلان", "أطفال")}`,
      );
    }
  }
  let summary = parts.join("، ") + ".";
  if (housekeepers.length > 0) {
    summary +=
      " يوجد خادمة تطبخ للعائلة وتنفذ الوصفات (ليست من المستفيدين من الخطة الغذائية).";
  }
  return summary;
}

class GateError extends Error {}

async function buildContextViaFetch(
  base: string,
  serviceKey: string,
  userId: string,
): Promise<PlanPromptContext> {
  const profile = await sbSelectOne(
    base,
    serviceKey,
    "profiles",
    `id=eq.${userId}&select=*`,
  );
  if (!profile) throw new GateError("Onboarding incomplete");
  if (!profile.onboarding_completed_at) throw new GateError("Onboarding incomplete");

  const medicalConditions = (profile.medical_conditions as string[] | null) ?? [];
  const hasMedical =
    !!profile.has_medical_conditions || medicalConditions.length > 0;
  // Mirrors HIGH_RISK_MEDICAL_FLAGS in the engine's buildContext (kept inline so
  // this bundle stays SDK-free). Most aren't captured by onboarding yet; OR'd
  // with the broad gate so today's behavior is unchanged.
  const HIGH_RISK_FLAGS = [
    "unstable_diabetes",
    "uncontrolled_hypertension",
    "heart_disease",
    "kidney_disease",
    "liver_disease",
    "unstable_thyroid",
    "severe_food_allergy",
    "acute_digestive",
    "eating_disorder",
    "post_surgical",
    "unexplained_symptoms",
  ];
  const hasHighRiskFlag = medicalConditions.some((c) =>
    HIGH_RISK_FLAGS.includes(c),
  );
  const isHighRiskPregnancy =
    !!profile.is_pregnant && !!profile.high_risk_pregnancy;
  if (
    (hasMedical ||
      profile.is_pregnant ||
      hasHighRiskFlag ||
      isHighRiskPregnancy) &&
    !profile.consulted_doctor
  ) {
    throw new GateError("Medical consultation required");
  }

  const family = await sbSelectMany(
    base,
    serviceKey,
    "family_members",
    `user_id=eq.${userId}&select=*&order=display_order.asc`,
  );

  const asStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  // Per-member medical gate (mirrors the engine's buildContext).
  for (const m of family) {
    const conds = asStrings(m.medical_conditions);
    const memberHighRisk =
      conds.some((c) => HIGH_RISK_FLAGS.includes(c)) || !!m.high_risk_pregnancy;
    if (memberHighRisk && m.consulted_doctor !== true) {
      throw new GateError("Medical consultation required");
    }
  }

  const family_members: PlanPromptContextMember[] = family.map((m) => {
    const age = ageFromBirthYear((m.birth_year as number | null) ?? null);
    const memberType = (m.member_type as string | null) ?? "adult";
    return {
      id: m.id as string,
      name: m.name as string,
      role: m.role as string,
      member_type: memberType,
      sex: (m.sex as string | null) ?? null,
      age,
      height_cm: (m.height_cm as number | null) ?? null,
      weight_kg: (m.weight_kg as number | null) ?? null,
      activity_level: ((m.activity_level as string | null) ?? null) as Activity,
      primary_goal: (m.primary_goal as string | null) ?? null,
      dietary_restrictions: asStrings(m.dietary_restrictions),
      medical_conditions: asStrings(m.medical_conditions),
      allergies: asStrings(m.allergies),
      dislikes: asStrings(m.dislikes),
      trimester: (m.trimester as number | null) ?? null,
      months_postpartum: (m.months_postpartum as number | null) ?? null,
      high_risk_pregnancy: !!m.high_risk_pregnancy,
      school_meal_handling: (m.school_meal_handling as string | null) ?? null,
      picky_eater: !!m.picky_eater,
      consulted_doctor: m.consulted_doctor === true,
      is_child: memberType === "child" || (age != null && age < 18),
      preferred_language: m.preferred_language as string,
      meal_mode: m.meal_mode === "independent" ? "independent" : "shared",
    };
  });

  // Housekeeper's reading language (only when she exists and it's not Arabic) —
  // drives the day-prompt translation directive. Mirrors buildContext.ts.
  const housekeeper = family_members.find((m) => m.role === "housekeeper");
  const hkLang = housekeeper?.preferred_language;
  const housekeeper_locale =
    hkLang && hkLang !== "ar" && (LOCALE_CODES as readonly string[]).includes(hkLang)
      ? (hkLang as LocaleCode)
      : undefined;

  return {
    mom: {
      id: profile.id as string,
      display_name: (profile.display_name as string | null) ?? null,
      sex: (profile.sex as string | null) ?? null,
      member_type: (profile.member_type as string | null) ?? "adult",
      age: ageFromBirthYear((profile.birth_year as number | null) ?? null),
      height_cm: (profile.height_cm as number | null) ?? null,
      weight_kg: (profile.weight_kg as number | null) ?? null,
      activity_level: ((profile.activity_level as string | null) ?? null) as Activity,
      primary_goal: (profile.primary_goal as string | null) ?? null,
      dietary_restrictions: (profile.dietary_restrictions as string[] | null) ?? [],
      cuisine_preference: profile.cuisine_preference as string,
      medical_conditions: medicalConditions,
      allergies: asStrings(profile.allergies),
      dislikes: asStrings(profile.dislikes),
      is_pregnant: !!profile.is_pregnant,
      pregnancy_trimester: (profile.pregnancy_trimester as number | null) ?? null,
      months_postpartum: (profile.months_postpartum as number | null) ?? null,
      high_risk_pregnancy: !!profile.high_risk_pregnancy,
      consulted_doctor: !!profile.consulted_doctor,
    },
    family_members,
    family_wide: {
      dietary_restrictions: asStrings(profile.family_dietary_restrictions),
      dislikes: asStrings(profile.family_dislikes),
      cooking_methods: asStrings(profile.cooking_methods),
      meal_out_frequency: (profile.meal_out_frequency as string | null) ?? null,
    },
    composition_summary: buildCompositionSummary(family_members),
    housekeeper_locale,
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────
export default async (req: Request): Promise<Response> => {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!expected || req.headers.get("x-internal-secret") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!supabaseUrl || !anthropicKey) {
    console.error("[generate-plan-background] missing env");
    return new Response("Server misconfigured", { status: 500 });
  }

  let body: {
    userId?: string;
    mealPlanId?: string;
    existingPlan?: MealPlan | null;
    mode?: "generate" | "translate";
    plan?: MealPlan | null;
    locale?: LocaleCode;
    feedback?: string;
    independentRegen?: boolean;
    // One-at-a-time add: generate ONLY this member; carry everyone else over.
    onlyMemberId?: string;
    // Per-member edit/regenerate target — authoritative for the loading screen's
    // member name (generating_member_id), even with other members still incomplete.
    regenerateMemberId?: string;
    // Literal partial regenerate scope (regenerate-scope dialog). With this set,
    // existingPlan is the WHOLE prior plan (target not stripped).
    regenScope?: "individual" | "shared" | "both";
    // Tier cap: when the family exceeds the plan limit, the allow-list of non-mom
    // beneficiary ids to generate this run (mom is always included). Others defer.
    limitMemberIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { userId, mealPlanId, existingPlan } = body;
  if (!userId || !mealPlanId) {
    return new Response("Missing userId or mealPlanId", { status: 400 });
  }

  // ── Translate mode: translate the existing plan IN PLACE (no regen) ──
  if (body.mode === "translate") {
    if (!body.plan || !body.locale) {
      return new Response("Missing plan or locale", { status: 400 });
    }
    const translateStartMs = Date.now();
    try {
      const { plan: translated, usage } = await translateMealPlan({
        anthropicApiKey: anthropicKey,
        plan: body.plan,
        locale: body.locale,
        // Persist each day as it lands (today-first) so the maid sees recipes
        // within seconds. The final update below is the complete snapshot.
        onDayTranslated: async (p) => {
          await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
            plan_data: p,
          });
        },
      });
      await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
        plan_data: translated,
      });
      // Audit the translation's token spend (see runMealPlanTranslation). The
      // weekly rate limit counts DISTINCT meal_plan_id, so this extra row
      // sharing the plan's id never consumes a generation slot.
      try {
        const completedAt = new Date().toISOString();
        await sbInsert(supabaseUrl, expected, "plan_generations", {
          user_id: userId,
          meal_plan_id: mealPlanId,
          model: usage.model,
          status: "completed",
          tokens_in: usage.input_tokens,
          tokens_out: usage.output_tokens,
          cost_usd: usage.cost_usd,
          duration_ms: Date.now() - translateStartMs,
          started_at: new Date(translateStartMs).toISOString(),
          completed_at: completedAt,
        });
      } catch (auditErr) {
        console.error(
          "[generate-plan-background] translate audit row failed",
          auditErr,
        );
      }
      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("[generate-plan-background] translate failed", err);
      // Non-fatal: leave the plan as-is (maid view falls back to Arabic).
      return new Response("Translate failed", { status: 200 });
    }
  }

  const startMs = Date.now();
  try {
    const context = await buildContextViaFetch(supabaseUrl, expected, userId);
    if (body.feedback) context.user_feedback = body.feedback;

    // One-at-a-time add: restrict this run to the existing plan's members plus
    // the single target, so other pending members are NOT generated here (they
    // generate later, one at a time). Mirrors triggerPlanGeneration's filter.
    if (body.onlyMemberId && existingPlan) {
      const keep = new Set(existingPlan.members.map((m) => m.member_id));
      keep.add(body.onlyMemberId);
      context.family_members = context.family_members.filter((m) =>
        keep.has(m.id),
      );
    }

    // Tier cap (full run): restrict to mom + the allow-listed beneficiaries; keep
    // housekeepers (they cook, aren't beneficiaries). Mirrors triggerPlanGeneration.
    if (body.limitMemberIds && !body.onlyMemberId) {
      const keep = new Set(body.limitMemberIds);
      context.family_members = context.family_members.filter(
        (m) => m.role === "housekeeper" || keep.has(m.id),
      );
    }

    const { plan, usage, missingDays } = await generateMealPlan({
      anthropicApiKey: anthropicKey,
      context,
      existingPlan: existingPlan ?? null,
      independentRegen: body.independentRegen,
      onlyMemberId: body.onlyMemberId,
      regenerateMemberId: body.regenerateMemberId,
      regenScope: body.regenScope,
      // Persist progressively + flip "ready" on the first emit (the shell), so
      // the plan opens showing all days as loading and they fill in 1→7.
      onProgress: async (snapshot) => {
        await sbUpdate(
          supabaseUrl,
          expected,
          "meal_plans",
          `id=eq.${mealPlanId}`,
          { status: "ready", plan_data: snapshot },
        );
      },
    });

    // End-of-run housekeeper translation. Re-read the housekeeper FRESH (catches
    // a maid added mid-generation, whose locale wasn't in the start context, so
    // the meals weren't born-translated). Runs here — while this generation's
    // plan_generations 'started' row is still live — so triggerPlanTranslation's
    // busy guard keeps any concurrent translate from racing us. The translated
    // plan becomes the final plan_data. Born-translated plans find nothing to do.
    let finalPlan = plan;
    let extraIn = 0;
    let extraOut = 0;
    let extraCost = 0;
    try {
      const hkRows = await sbSelectMany(
        supabaseUrl,
        expected,
        "family_members",
        `user_id=eq.${userId}&role=eq.housekeeper&select=preferred_language&limit=1`,
      );
      const hkLang = hkRows[0]?.preferred_language as string | undefined;
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
      // Only translate once the WHOLE family is fully generated — every member,
      // day 1 → last day. Skip while any member is absent OR still has an unfilled
      // day (under the retry cap): the drain finishes them one at a time and a
      // later run translates the complete plan. Translating earlier would localize
      // a partial plan (and hold this run's 'started' lock through translation).
      const memberRows = await sbSelectMany(
        supabaseUrl,
        expected,
        "family_members",
        `user_id=eq.${userId}&select=id,role`,
      );
      let familyMemberIds = memberRows
        .filter((m) => m.role !== "housekeeper")
        .map((m) => m.id as string);
      // Tier-capped run: only mom + the allow-listed members are in this plan, so
      // gate translation on THAT set — otherwise the deferred (tier-blocked) members
      // would keep it "still generating" forever and the maid never gets translated.
      if (body.limitMemberIds) {
        const keep = new Set(body.limitMemberIds);
        familyMemberIds = familyMemberIds.filter((id) => keep.has(id));
      }
      const stillGenerating = hasPendingGeneration({
        plan,
        familyMemberIds,
        maxAttempts: MEMBER_GEN_MAX_ATTEMPTS,
      });
      if (endLocale && needsTranslate && !stillGenerating) {
        const { plan: translated, usage: tUsage } = await translateMealPlan({
          anthropicApiKey: anthropicKey,
          plan,
          locale: endLocale,
          onDayTranslated: async (p) => {
            await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
              plan_data: p,
            });
          },
        });
        finalPlan = translated;
        extraIn = tUsage.input_tokens;
        extraOut = tUsage.output_tokens;
        extraCost = tUsage.cost_usd;
      }
    } catch (hkErr) {
      // Non-fatal: leave the (untranslated) plan as-is; the maid view falls back
      // to Arabic and her page re-triggers a translate on next visit.
      console.warn(
        "[generate-plan-background] end-of-run housekeeper translate failed",
        hkErr,
      );
    }

    const durationMs = Date.now() - startMs;
    const generatedAt = new Date().toISOString();

    // Partial plan: some days were dropped after retries. Status stays
    // "completed" (the CHECK allows only started/completed/failed), but record a
    // PII-safe note (day indices only — never recipe/member content) so partials
    // are auditable.
    const partialNote =
      missingDays.length > 0 ? `partial: days [${missingDays.join(", ")}] failed` : null;
    if (partialNote) {
      console.warn(`[generate-plan-background] ${partialNote}`, { userId, mealPlanId });
    }

    await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
      status: "ready",
      plan_data: finalPlan,
      generated_at: generatedAt,
      ai_input_tokens: usage.input_tokens,
      ai_output_tokens: usage.output_tokens,
      ai_generation_seconds: durationMs / 1000,
    });
    await sbUpdate(
      supabaseUrl,
      expected,
      "plan_generations",
      `meal_plan_id=eq.${mealPlanId}`,
      {
        status: "completed",
        tokens_in: usage.input_tokens + extraIn,
        tokens_out: usage.output_tokens + extraOut,
        cost_usd: usage.cost_usd + extraCost,
        duration_ms: durationMs,
        completed_at: generatedAt,
        error_message: partialNote,
      },
    );

    console.log("[generate-plan-background] completed", {
      userId,
      mealPlanId,
      tokensOut: usage.output_tokens,
      durationMs,
      missingDays,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error("[generate-plan-background] error", { userId, mealPlanId, errorMessage });
    try {
      await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
        status: "failed",
        error_message: errorMessage,
      });
      await sbUpdate(
        supabaseUrl,
        expected,
        "plan_generations",
        `meal_plan_id=eq.${mealPlanId}`,
        {
          status: "failed",
          error_message: errorMessage,
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        },
      );
    } catch (updateErr) {
      console.error("[generate-plan-background] failed to mark rows failed", updateErr);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
