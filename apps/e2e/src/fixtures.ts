/**
 * Shared test surface: the extended `test` object plus the small helpers every
 * spec needs. Keeping these here means a spec reads as the scenario it describes
 * rather than as plumbing.
 */

import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { BILLING_TAG, getConfig, requireWebhookSecret, type E2EConfig } from "./config.js";
import {
  createConfirmedAccount,
  newTestIdentity,
  type TestAccount,
} from "./accounts.js";
import { signWebhook, WEBHOOK_PATH } from "./lemonsqueezy.js";

/** Stable per-process run id; makes every issued email traceable to one run. */
export const RUN_ID = `${Date.now().toString(36)}`;

export interface Fixtures {
  cfg: E2EConfig;
}

export const test = base.extend<Fixtures>({
  cfg: async ({}, use) => {
    await use(getConfig());
  },
});

export { expect };

/**
 * Declare, in plain language, what a test proves. Surfaces in the generated
 * report's "What it verifies" column — the report is a deliverable here, so the
 * intent is captured at the test rather than reconstructed afterwards.
 */
export function verifies(intent: string): void {
  test.info().annotations.push({ type: "verifies", description: intent });
}

/** Mint a throwaway confirmed account, already registered for teardown. */
export async function freshAccount(slug: string): Promise<TestAccount> {
  return createConfirmedAccount(newTestIdentity(RUN_ID, slug), slug);
}

export { newTestIdentity, BILLING_TAG, requireWebhookSecret };

/**
 * POST a webhook to the app exactly as LemonSqueezy would.
 *
 * The body is transmitted as the same raw string that was signed — re-serializing
 * an object here would change key order or spacing and the app's HMAC check would
 * (correctly) reject it.
 *
 * `secret` is passed in rather than read from config because it is only available
 * during the @billing phase; callers resolve it via `requireWebhookSecret(cfg)`,
 * which fails with an actionable message instead of a bare 401.
 */
export async function postWebhook(
  request: APIRequestContext,
  rawBody: string,
  secret: string,
  options: { signature?: string } = {},
) {
  return request.post(WEBHOOK_PATH, {
    headers: {
      "Content-Type": "application/json",
      "X-Signature": options.signature ?? signWebhook(rawBody, secret),
    },
    data: rawBody,
  });
}

/**
 * An API context carrying the test user's Supabase session cookies.
 *
 * The app reads its session from cookies via @supabase/ssr, so route handlers like
 * /api/checkout need a browser-shaped session rather than a bearer token. Signing
 * in through the real login form is the only way to produce cookies the middleware
 * will accept, so this drives that form once and hands back the resulting context.
 */
export async function signedInApiContext(
  browser: import("@playwright/test").Browser,
  baseUrl: string,
  email: string,
  password: string,
): Promise<{ request: APIRequestContext; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  await page.goto("/auth/login");
  await page.getByLabel("الإيميل").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
    timeout: 30_000,
  });
  await page.close();

  return {
    request: context.request,
    close: () => context.close(),
  };
}
