import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BODY_PHOTOS_BUCKET } from "@/lib/engagement/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Every table the customer owns rows in. The four engagement tables landed in
// 00017; workout_checkins, meal_absences and chat_messages later (00020, 00021,
// 00006) — all applied to production, so a read error on any of them is a real
// failure, not a missing migration.
const UNTYPED_TABLES = [
  "meal_checkins",
  "member_exceptions",
  "meal_verdicts",
  "body_logs",
  "workout_checkins",
  "meal_absences",
  "chat_messages",
] as const;

// Internal billing identifiers — not the user's own data, so they're stripped
// from the subscription before it goes into the portability export.
const INTERNAL_SUB_FIELDS = [
  "lemonsqueezy_subscription_id",
  "lemonsqueezy_customer_id",
  "lemonsqueezy_variant_id",
  "ls_subscription_id",
  "ls_customer_id",
  "ls_variant_id",
  "ls_order_id",
] as const;

function stripInternal(
  sub: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!sub) return null;
  const clone = { ...sub };
  for (const f of INTERNAL_SUB_FIELDS) delete clone[f];
  return clone;
}

/** A query that failed. The export is refused rather than shipped hollow. */
class ExportReadError extends Error {
  constructor(
    public readonly table: string,
    public readonly detail: string,
  ) {
    super(`export read failed: ${table}`);
  }
}

function must<T>(table: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new ExportReadError(table, res.error.message);
  return res.data;
}

/**
 * Data export (PDPL right to portability). Returns everything the user owns as
 * a downloadable JSON file. Auth-gated; reads run through the user's own
 * (RLS-scoped) client so a request can only ever export its own rows.
 *
 * A read that fails is a 503, not an empty section: this route used to consume
 * every query as `data ?? []`, so a transient PostgREST error, a statement
 * timeout on a large plan_data blob, or an RLS regression produced a file
 * with a silently missing table and HTTP 200 — the one document a customer
 * has no way to check for completeness.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const untyped = supabase as unknown as SupabaseClient;

  try {
    // Every table read keys only on user.id — one parallel batch.
    const [profile, family, plans, workoutPlans, subscription, generations, ...untypedRows] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()
          .then((r) => must("profiles", r)),
        supabase
          .from("family_members")
          .select("*")
          .eq("user_id", user.id)
          .order("display_order", { ascending: true })
          .then((r) => must("family_members", r)),
        supabase
          .from("meal_plans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .then((r) => must("meal_plans", r)),
        supabase
          .from("workout_plans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .then((r) => must("workout_plans", r)),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => must("subscriptions", r)),
        supabase
          .from("plan_generations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .then((r) => must("plan_generations", r)),
        ...UNTYPED_TABLES.map((table) =>
          untyped
            .from(table)
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .then((r) => must(table, r) ?? []),
        ),
      ]);

    const [
      mealCheckins,
      memberExceptions,
      mealVerdicts,
      bodyLogRows,
      workoutCheckins,
      mealAbsences,
      chatMessages,
    ] = untypedRows as unknown[][];
    let bodyLogs: unknown[] = bodyLogRows ?? [];

    // Portability covers the photos too: each body log with a photo_path gets
    // a 24-hour signed URL (the bucket is private — a bare path downloads
    // nothing). Signing is an enrichment: the rows themselves are already in
    // the file, so a signing failure is logged, not fatal.
    try {
      const logRows = bodyLogs as Array<Record<string, unknown>>;
      const photoPaths = logRows
        .map((r) => r.photo_path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (photoPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from(BODY_PHOTOS_BUCKET)
          .createSignedUrls(photoPaths, 60 * 60 * 24);
        const urlByPath = new Map(
          (signed ?? [])
            .filter((s) => s.signedUrl)
            .map((s) => [s.path, s.signedUrl] as const),
        );
        bodyLogs = logRows.map((r) =>
          typeof r.photo_path === "string" && urlByPath.has(r.photo_path)
            ? { ...r, photo_url: urlByPath.get(r.photo_path) }
            : r,
        );
      }
    } catch (err) {
      console.error("[export] photo signing failed", err);
    }

    const data = {
      exported_at: new Date().toISOString(),
      user: {
        email: user.email ?? null,
        signup_date: user.created_at,
      },
      profile: profile ?? null,
      family_members: family ?? [],
      meal_plans: plans ?? [],
      workout_plans: workoutPlans ?? [],
      subscription: stripInternal(subscription as Record<string, unknown> | null),
      generation_history: generations ?? [],
      meal_checkins: mealCheckins ?? [],
      member_exceptions: memberExceptions ?? [],
      meal_verdicts: mealVerdicts ?? [],
      meal_absences: mealAbsences ?? [],
      body_logs: bodyLogs,
      workout_checkins: workoutCheckins ?? [],
      chat_messages: chatMessages ?? [],
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="fitlife-export-${user.id}-${date}.json"`,
      },
    });
  } catch (err) {
    const table = err instanceof ExportReadError ? err.table : "unknown";
    console.error("[export] refused — read failed", { table, err });
    Sentry.captureException(err, {
      tags: { area: "account-export", table, userId: user.id },
    });
    // The button navigates the window to this route, so the body is what the
    // customer sees — plain Arabic text, not JSON.
    return new Response(
      "تعذّر تجهيز ملف بياناتك الآن. يرجى المحاولة بعد قليل.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}
