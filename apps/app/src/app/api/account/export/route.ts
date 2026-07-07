import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

/**
 * Data export (PDPL right to portability). Returns everything the user owns as
 * a downloadable JSON file. Auth-gated; reads run through the user's own
 * (RLS-scoped) client so a request can only ever export its own rows.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [profile, family, plans, workoutPlans, subscription, generations] = await Promise.all(
    [
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("family_members")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true }),
      supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("workout_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("plan_generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ],
  );

  const data = {
    exported_at: new Date().toISOString(),
    user: {
      email: user.email ?? null,
      signup_date: user.created_at,
    },
    profile: profile.data ?? null,
    family_members: family.data ?? [],
    meal_plans: plans.data ?? [],
    workout_plans: workoutPlans.data ?? [],
    subscription: stripInternal(
      subscription.data as Record<string, unknown> | null,
    ),
    generation_history: generations.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fitlife-export-${user.id}-${date}.json"`,
    },
  });
}
