/**
 * Test-account lifecycle: mint, confirm, sign in, erase.
 *
 * Every address is issued under the reserved `@e2e.fitlife.invalid` domain, which
 * is what makes cleanup safe to automate (see guards.assertDeletableTestAccount)
 * and what makes leftovers obvious in the Supabase dashboard.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config.js";
import { admin, anon, waitFor } from "./supabase.js";
import { assertDeletableTestAccount, TEST_EMAIL_DOMAIN } from "./guards.js";
import { registerAccount } from "./registry.js";

/** Satisfies both the app's 8-char minimum and Supabase's own password policy. */
export const TEST_PASSWORD = "FitLifeE2E!2026";

export interface TestIdentity {
  email: string;
  password: string;
}

/**
 * A fresh, collision-proof identity. The run id keeps parallel/rerun accounts
 * apart; the slug makes it obvious in the dashboard which spec owns the row.
 */
export function newTestIdentity(runId: string, slug: string): TestIdentity {
  return {
    email: `e2e-${slug}-${runId}-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`,
    password: TEST_PASSWORD,
  };
}

export interface TestAccount {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
}

/**
 * Locate a user by email.
 *
 * GoTrue's JS admin API has no get-by-email, so this pages through listUsers.
 * That is acceptable here precisely because it is only ever called seconds after
 * the account was created (page 1 in practice) and only against a disposable
 * test project — it is not a pattern to copy into app code.
 */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string | undefined; confirmed: boolean } | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin().auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) {
      return {
        id: found.id,
        email: found.email,
        confirmed: Boolean(found.email_confirmed_at),
      };
    }
    if (data.users.length < 200) break;
  }
  return null;
}

/** Mark a signed-up user's email confirmed — stands in for clicking the email link. */
export async function confirmEmail(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) throw error;
}

/** Sign in with the anon key and return the session's access token. */
export async function signIn(identity: TestIdentity): Promise<string> {
  const { data, error } = await anon().auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  if (error) throw new Error(`Sign-in failed for ${identity.email}: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error(`Sign-in returned no session for ${identity.email}`);
  return token;
}

/**
 * Create a pre-confirmed account directly via the admin API.
 *
 * Used by the supporting specs (checkout guards, webhook contract, tier limits)
 * where the signup UI is not what is under test — going through the form there
 * would only add latency and a shared failure mode. The main journey spec uses
 * the real signup form instead.
 */
export async function createConfirmedAccount(
  identity: TestIdentity,
  origin: string,
): Promise<TestAccount> {
  const { data, error } = await admin().auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
  });
  if (error) throw new Error(`Could not create test user: ${error.message}`);
  const userId = data.user?.id;
  if (!userId) throw new Error("Supabase created a user but returned no id");

  trackAccount(userId, identity.email, origin);
  await waitForAccountSeed(userId);

  return {
    userId,
    email: identity.email,
    password: identity.password,
    accessToken: await signIn(identity),
  };
}

/** Record the account for teardown. Called the instant a user id exists. */
export function trackAccount(userId: string, email: string, origin: string): void {
  registerAccount(getConfig().stateDir, {
    userId,
    email,
    origin,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Wait for the `handle_new_user` trigger (migration 00004) to seed the profile
 * and the 7-day trial subscription. This is the one genuinely async seam right
 * after signup, and several assertions depend on those rows existing.
 */
export async function waitForAccountSeed(userId: string): Promise<void> {
  await waitFor(`profiles row for ${userId}`, async () => {
    const { data } = await admin()
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    return data;
  });
  await waitFor(`seeded trial subscription for ${userId}`, async () => {
    const { data } = await admin()
      .from("subscriptions")
      .select("id, status, tier")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  });
}

/**
 * Hard-delete a test account.
 *
 * Deliberately mirrors `apps/app/src/lib/account/erase.ts`: clear the private
 * body-photos folder (storage does not cascade) and then delete the auth user,
 * which CASCADEs through profiles, family_members, meal_plans, subscriptions,
 * plan_generations and the engagement tables. Refuses any address the suite did
 * not issue.
 */
export async function eraseAccount(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  assertDeletableTestAccount(email, userId);
  const client: SupabaseClient = admin();

  try {
    const { data: objects } = await client.storage
      .from("body-photos")
      .list(userId, { limit: 1000 });
    const paths = (objects ?? []).filter((o) => o.name).map((o) => `${userId}/${o.name}`);
    if (paths.length > 0) {
      await client.storage.from("body-photos").remove(paths);
    }
  } catch {
    // Bucket may not exist yet (migration 00018 is unapplied on some stacks).
    // An orphaned private object must never block deletion of the identifying rows.
  }

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
}
