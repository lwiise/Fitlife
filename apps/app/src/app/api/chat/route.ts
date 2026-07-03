import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  streamAnthropic,
  computeCostUsd,
  PLAN_MODEL,
} from "@fitlife/plan-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getAnthropicKey } from "@/lib/env";
import { hasAdvisorAccess } from "@/lib/subscription/access";
import { buildHouseholdContext } from "@/lib/chat/context";
import { CHAT_SYSTEM_STATIC, buildChatSystemPrompt } from "@/lib/chat/systemRules";

export const runtime = "nodejs";
export const maxDuration = 60;

// Conservative per-user daily message cap (see migration 00006 rationale).
const DAILY_CAP = 30;
// Cap turns sent to the model (token budget); keep the most recent.
const MAX_HISTORY = 20;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * POST /api/chat — read-only Arabic advisor (Sara). Streams the reply token-by-
 * token as plain text. Hard read-only: the ONLY write is a metadata-only usage
 * audit row (no chat content) for the daily cap + model-aware cost logging. No
 * plan/profile/family writes, no generation trigger, no admin client, no tools.
 */
export async function POST(request: Request) {
  // Typed as the supabase-js client so the .insert() below validates columns:
  // the @supabase/ssr return type trips a postgrest-js@2.106 generic bug that
  // resolves write params to `never` (same one-cast pattern as lib/admin/db.ts).
  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const access = await hasAdvisorAccess(user.id);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "المستشارة للمشتركات فقط — فعّلي اشتراكك للوصول" },
      { status: 402 },
    );
  }

  // Daily cap from the usage-audit table. Fail-open if the table isn't present
  // yet (preview before the migration is applied) — never block the feature on
  // a missing audit table.
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (!error && (count ?? 0) >= DAILY_CAP) {
      return NextResponse.json(
        { error: "وصلتِ للحد اليومي من الأسئلة. حاولي مرة ثانية باكر." },
        { status: 429 },
      );
    }
  } catch {
    // fail-open
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (parsed.messages[parsed.messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  const history = parsed.messages.slice(-MAX_HISTORY);

  const householdContext = await buildHouseholdContext(user.id);
  const systemPrompt = buildChatSystemPrompt(householdContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await streamAnthropic({
          apiKey: getAnthropicKey(),
          model: PLAN_MODEL,
          maxTokens: 1500,
          systemStatic: CHAT_SYSTEM_STATIC,
          systemPrompt,
          messages: history,
          // Must finish under the route's maxDuration (60s): the engine
          // default (240s) would let the platform kill a stalled stream with
          // the usage-audit row below never written.
          timeoutMs: 55_000,
          onText: (delta) => controller.enqueue(encoder.encode(delta)),
        });
        // Audit-only write: rate-limit source + model-aware cost. No content.
        try {
          await supabase.from("chat_messages").insert({
            user_id: user.id,
            model: PLAN_MODEL,
            tokens_in: result.tokensIn,
            tokens_out: result.tokensOut,
            cost_usd: computeCostUsd(result.tokensIn, result.tokensOut, PLAN_MODEL),
          });
        } catch (logErr) {
          console.error("[chat] usage log failed", logErr);
        }
      } catch (err) {
        console.error("[chat] stream failed", err);
        Sentry.captureException(err, {
          tags: { area: "advisor-chat", userId: user.id },
        });
        controller.enqueue(
          encoder.encode("\n\nصار خطأ غير متوقع. حاولي مرة ثانية."),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
