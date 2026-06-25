import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelLemonsqueezySubscription } from "@/lib/lemonsqueezy/cancel";

/**
 * Hard-delete a user account (PDPL right to erasure). Cancels the LemonSqueezy
 * subscription first if it's live (best-effort — an LS failure must NOT block
 * erasure), then deletes the auth.users row, which CASCADEs through the FKs to
 * remove profiles, family_members, meal_plans, subscriptions, plan_generations
 * and chat_messages.
 *
 * Shared by the user-facing /api/account/delete route (self-service) and the
 * admin "delete subscriber" action. Throws on the hard-delete failure so callers
 * can surface it; only the UUID is sent to Sentry, never PII.
 */
export async function eraseUserAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const lsId = (sub as { lemonsqueezy_subscription_id: string | null } | null)
    ?.lemonsqueezy_subscription_id;
  const lsStatus = (sub as { status: string } | null)?.status;
  if (lsId && (lsStatus === "active" || lsStatus === "past_due")) {
    try {
      await cancelLemonsqueezySubscription(lsId);
    } catch (e) {
      Sentry.captureException(e, {
        tags: { area: "account-erase-ls-cancel", userId },
      });
      // Continue with erasure regardless (PDPL takes precedence).
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    Sentry.captureException(error, {
      tags: { area: "account-erase-hard-delete", userId },
      level: "fatal",
    });
    throw error;
  }
}
