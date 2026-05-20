// Netlify background function (15-min budget) for AI meal-plan generation.
//
// Bundle-safety: zip-it-and-ship-it (esbuild) chokes on the @supabase/supabase-js
// and @anthropic-ai/sdk packages (optional native/realtime deps), which crashed
// this function at cold-start import time. So we talk to both services over plain
// `fetch` (PostgREST for Supabase, the Messages API for Anthropic) and import only
// the PURE engine pieces (system prompt + Zod schema — zod is the only npm dep,
// and it always bundles). The system prompt + schema stay the single source of
// truth in @fitlife/plan-engine; the relative paths let esbuild inline them.

import { MealPlanSchema } from "../../../../packages/plan-engine/src/schema";
import { buildSystemPrompt } from "../../../../packages/plan-engine/src/systemPrompt";
import type {
  PlanPromptContext,
  PlanPromptContextMember,
} from "../../../../packages/plan-engine/src/buildContext";
import {
  PLAN_MODEL,
  PLAN_MAX_TOKENS,
  PRICING_USD_PER_MTOK,
} from "../../../../packages/plan-engine/src/constants";

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
  if ((hasMedical || profile.is_pregnant) && !profile.consulted_doctor) {
    throw new GateError("Medical consultation required");
  }

  const family = await sbSelectMany(
    base,
    serviceKey,
    "family_members",
    `user_id=eq.${userId}&select=*&order=display_order.asc`,
  );

  const family_members: PlanPromptContextMember[] = family.map((m) => ({
    id: m.id as string,
    name: m.name as string,
    role: m.role as string,
    age: ageFromBirthYear((m.birth_year as number | null) ?? null),
    height_cm: (m.height_cm as number | null) ?? null,
    weight_kg: (m.weight_kg as number | null) ?? null,
    activity_level: ((m.activity_level as string | null) ?? null) as Activity,
    primary_goal: (m.primary_goal as string | null) ?? null,
    dietary_restrictions: (m.dietary_restrictions as string[] | null) ?? [],
    preferred_language: m.preferred_language as string,
  }));

  return {
    mom: {
      id: profile.id as string,
      display_name: (profile.display_name as string | null) ?? null,
      age: ageFromBirthYear((profile.birth_year as number | null) ?? null),
      height_cm: (profile.height_cm as number | null) ?? null,
      weight_kg: (profile.weight_kg as number | null) ?? null,
      activity_level: ((profile.activity_level as string | null) ?? null) as Activity,
      primary_goal: (profile.primary_goal as string | null) ?? null,
      dietary_restrictions: (profile.dietary_restrictions as string[] | null) ?? [],
      cuisine_preference: profile.cuisine_preference as string,
      medical_conditions: medicalConditions,
      is_pregnant: !!profile.is_pregnant,
      pregnancy_trimester: (profile.pregnancy_trimester as number | null) ?? null,
      consulted_doctor: !!profile.consulted_doctor,
    },
    family_members,
    composition_summary: buildCompositionSummary(family_members),
  };
}

// ─── Anthropic Messages API over fetch ─────────────────────────────────────
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
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

  let body: { userId?: string; mealPlanId?: string; methodologyOverride?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { userId, mealPlanId, methodologyOverride } = body;
  if (!userId || !mealPlanId) {
    return new Response("Missing userId or mealPlanId", { status: 400 });
  }

  const startMs = Date.now();
  try {
    const context = await buildContextViaFetch(supabaseUrl, expected, userId);

    let systemPrompt = buildSystemPrompt(context);
    if (methodologyOverride) {
      systemPrompt = systemPrompt.replace(
        "{{METHODOLOGY_PLACEHOLDER}}",
        methodologyOverride,
      );
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        max_tokens: PLAN_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: "أنشئي الخطة الآن." }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      throw new Error(`Anthropic API ${anthropicRes.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await anthropicRes.json()) as AnthropicResponse;
    const tokensIn = data.usage.input_tokens;
    const tokensOut = data.usage.output_tokens;
    const rawText = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");

    if (!rawText.trim()) throw new Error("Empty response from Anthropic");

    const parsed = JSON.parse(stripMarkdownFence(rawText));
    const result = MealPlanSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Zod validation failed: ${result.error.message.slice(0, 500)}`);
    }

    const durationMs = Date.now() - startMs;
    const costUsd = computeCostUsd(tokensIn, tokensOut);
    const generatedAt = new Date().toISOString();

    await sbUpdate(supabaseUrl, expected, "meal_plans", `id=eq.${mealPlanId}`, {
      status: "ready",
      plan_data: result.data,
      generated_at: generatedAt,
      ai_input_tokens: tokensIn,
      ai_output_tokens: tokensOut,
      ai_generation_seconds: durationMs / 1000,
    });
    await sbUpdate(
      supabaseUrl,
      expected,
      "plan_generations",
      `meal_plan_id=eq.${mealPlanId}`,
      {
        status: "completed",
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: costUsd,
        duration_ms: durationMs,
        completed_at: generatedAt,
      },
    );

    console.log("[generate-plan-background] completed", {
      userId,
      mealPlanId,
      tokensOut,
      durationMs,
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
