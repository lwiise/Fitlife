import { createClient } from "@/lib/supabase/server";
import { eraseUserAccount } from "@/lib/account/erase";

export const runtime = "nodejs";

/**
 * Account deletion (PDPL right to erasure). Immediate hard delete, no grace
 * period. Sequence is deliberate:
 *   1. Auth gate FIRST — never delete without a verified session.
 *   2. Sign out (invalidate the session cookie).
 *   3. eraseUserAccount: cancel the LS subscription (best-effort) then hard-delete
 *      the auth.users row → CASCADE removes profiles, family_members, meal_plans,
 *      subscriptions, plan_generations, chat_messages.
 *
 * Only `user.id` (a UUID) is ever sent to Sentry (inside the helper) — never PII.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Invalidate the current session before removing the user.
  await supabase.auth.signOut();

  try {
    await eraseUserAccount(user.id);
  } catch {
    // The user is signed out but their data still exists — surfaced to Sentry
    // inside the helper; show a localized retry/contact message.
    return Response.json(
      { error: "حدث خطأ في حذف حسابك. تواصلي معنا" },
      { status: 500 },
    );
  }

  return Response.json({ deleted: true });
}
