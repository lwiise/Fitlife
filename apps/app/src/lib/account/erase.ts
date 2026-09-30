import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { BODY_PHOTOS_BUCKET } from "@/lib/engagement/types";
import { PROFILE_PHOTOS_BUCKET } from "@/lib/profilePhoto/shared";
import { cancelLemonsqueezySubscription } from "@/lib/lemonsqueezy/cancel";

/**
 * Hard-delete a user account (PDPL right to erasure). Cancels the LemonSqueezy
 * subscription first if it's live (best-effort — an LS failure must NOT block
 * erasure), then deletes the auth.users row, which CASCADEs through the FKs to
 * remove profiles, family_members, meal_plans, subscriptions, plan_generations,
 * chat_messages and the 00017 engagement tables.
 *
 * Storage does NOT cascade: the account's body-photos (00018) and
 * profile-photos (00028) folders are removed explicitly, best-effort BEFORE
 * the auth delete — a storage hiccup must never block erasure of the
 * identifying rows, and an orphaned unreadable object is strictly less
 * sensitive than a live account.
 *
 * Shared by the user-facing /api/account/delete route (self-service) and the
 * admin "delete subscriber" action. Throws on the hard-delete failure so callers
 * can surface it; only the UUID is sent to Sentry, never PII.
 */
export async function eraseUserAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Body progress photos (00018) and profile photos (00028) both live flat
  // under <user_id>/, so one list + one remove per bucket covers the whole
  // account. Tolerant of a prod where a bucket does not exist yet.
  for (const bucket of [BODY_PHOTOS_BUCKET, PROFILE_PHOTOS_BUCKET]) {
    try {
      const { data: objects } = await admin.storage
        .from(bucket)
        .list(userId, { limit: 1000 });
      const paths = (objects ?? [])
        .filter((o) => o.name)
        .map((o) => `${userId}/${o.name}`);
      if (paths.length > 0) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw removeError;
      }
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          area:
            bucket === BODY_PHOTOS_BUCKET
              ? "account-erase-body-photos"
              : "account-erase-profile-photos",
          userId,
        },
      });
      // Continue with erasure regardless (PDPL takes precedence).
    }
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const lsId = (sub as { lemonsqueezy_subscription_id: string | null } | null)
    ?.lemonsqueezy_subscription_id;
  const lsStatus = (sub as { status: string } | null)?.status;
  // Cancel on any status that can still BILL. 'paused' was missing and matters
  // most: a LemonSqueezy pause AUTO-RESUMES at resumes_at (our own pause sets
  // that 30 days out), so a customer who paused and then deleted their account
  // was charged again a month later, with no account left to cancel from and
  // their data already erased. 'trialing' is included for the same reason — a
  // trial that converts bills a deleted customer. 'cancelled' and 'expired' are
  // correctly skipped: they cannot bill again.
  const BILLABLE_STATUSES = ["active", "past_due", "paused", "trialing"];
  if (lsId && lsStatus != null && BILLABLE_STATUSES.includes(lsStatus)) {
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
