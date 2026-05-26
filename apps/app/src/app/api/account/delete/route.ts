import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelLemonsqueezySubscription } from "@/lib/lemonsqueezy/cancel";

export const runtime = "nodejs";

/**
 * Account deletion (PDPL right to erasure). Immediate hard delete, no grace
 * period. Sequence is deliberate:
 *   1. Auth gate FIRST — never delete without a verified session.
 *   2. Cancel the LS subscription if active/past_due (best-effort, never blocks).
 *   3. Sign out (invalidate the session cookie).
 *   4. Hard-delete the auth.users row → CASCADE removes profiles, family_members,
 *      meal_plans, subscriptions, plan_generations.
 *
 * Only `user.id` (a UUID) is ever sent to Sentry — never email or other PII.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();

  // Cancel the Lemonsqueezy subscription before deleting — but an LS failure
  // must NOT block erasure (PDPL). Log to Sentry and proceed.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const lsId = (sub as { lemonsqueezy_subscription_id: string | null } | null)
    ?.lemonsqueezy_subscription_id;
  const lsStatus = (sub as { status: string } | null)?.status;
  if (lsId && (lsStatus === "active" || lsStatus === "past_due")) {
    try {
      await cancelLemonsqueezySubscription(lsId);
    } catch (e) {
      Sentry.captureException(e, {
        tags: { area: "account-deletion-ls-cancel", userId: user.id },
      });
      // Continue with deletion regardless.
    }
  }

  // Invalidate the current session before removing the user.
  await supabase.auth.signOut();

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    // The user is signed out but their data still exists — critical.
    Sentry.captureException(deleteError, {
      tags: { area: "account-deletion-hard-delete", userId: user.id },
      level: "fatal",
    });
    return Response.json(
      { error: "حدث خطأ في حذف حسابك. تواصلي معنا" },
      { status: 500 },
    );
  }

  return Response.json({ deleted: true });
}
