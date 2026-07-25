import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { BODY_PHOTOS_BUCKET } from "@/lib/engagement/types";
import { cancelLemonsqueezySubscription } from "@/lib/lemonsqueezy/cancel";

/**
 * Hard-delete a user account (PDPL right to erasure). Cancels the LemonSqueezy
 * subscription first if it's live (best-effort — an LS failure must NOT block
 * erasure), then deletes the auth.users row, which CASCADEs through the FKs to
 * remove profiles, family_members, meal_plans, subscriptions, plan_generations,
 * chat_messages and the 00017 engagement tables.
 *
 * Storage does NOT cascade: the account's body-photos folder (00018) is removed
 * explicitly, best-effort BEFORE the auth delete — a storage hiccup must never
 * block erasure of the identifying rows, and an orphaned unreadable object is
 * strictly less sensitive than a live account.
 *
 * Shared by the user-facing /api/account/delete route (self-service) and the
 * admin "delete subscriber" action. Throws on the hard-delete failure so callers
 * can surface it; only the UUID is sent to Sentry, never PII.
 */
export async function eraseUserAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Body progress photos live flat under <user_id>/ (00018 path convention),
  // so one list + one remove covers the whole account. Tolerant of a
  // pre-00018 prod where the bucket doesn't exist yet.
  try {
    const { data: objects } = await admin.storage
      .from(BODY_PHOTOS_BUCKET)
      .list(userId, { limit: 1000 });
    const paths = (objects ?? [])
      .filter((o) => o.name)
      .map((o) => `${userId}/${o.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(BODY_PHOTOS_BUCKET)
        .remove(paths);
      if (removeError) throw removeError;
    }
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "account-erase-body-photos", userId },
    });
    // Continue with erasure regardless (PDPL takes precedence).
  }

  // NOT maybeSingle(): `subscriptions` has no unique(user_id) (see
  // subscription/state.ts), so a second row made this read error out and
  // return null — silently skipping the cancellation and leaving the deleted
  // account still billing, with no UI left to cancel from. Read every row and
  // cancel each live subscription.
  const { data: subs, error: subsError } = await admin
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", userId)
    .returns<{ lemonsqueezy_subscription_id: string | null; status: string }[]>();
  if (subsError) {
    Sentry.captureException(subsError, {
      tags: { area: "account-erase-ls-read", userId },
    });
  }

  const liveLsIds = [
    ...new Set(
      (subs ?? [])
        .filter((s) => s.status === "active" || s.status === "past_due")
        .map((s) => s.lemonsqueezy_subscription_id)
        .filter((id): id is string => !!id),
    ),
  ];
  for (const lsId of liveLsIds) {
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
