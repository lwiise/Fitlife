/**
 * Browser-level helpers for the two screens the suite drives directly.
 *
 * Selectors are label- and role-based rather than CSS: the app ships no
 * `data-testid` anywhere, and its class names are Tailwind utility soup that
 * changes on any restyle. Querying by the Arabic label a user actually reads is
 * both more stable and a real accessibility assertion — if `getByLabel("الإيميل")`
 * stops resolving, the input has lost its label and a screen-reader user has lost
 * the form.
 */

import type { Page } from "@playwright/test";
import type { TestIdentity } from "./accounts.js";

export const LOGIN_PATH = "/auth/login";

export type SignUpOutcome =
  | { kind: "session" }
  | { kind: "confirm-required" }
  | { kind: "error"; message: string };

/**
 * Complete the standard signup form.
 *
 * Three legitimate outcomes, all of which the app really produces:
 *  • a session (email confirmation disabled) → redirected out of /auth
 *  • the "رسالة التأكيد في إيميلك" screen (confirmation enabled)
 *  • an inline error
 */
export async function signUpViaForm(
  page: Page,
  identity: TestIdentity,
): Promise<SignUpOutcome> {
  await page.goto(`${LOGIN_PATH}?mode=signup`);

  await page.getByLabel("الإيميل").fill(identity.email);
  await page.getByLabel("كلمة المرور").fill(identity.password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();

  const confirmScreen = page.getByRole("heading", { name: "رسالة التأكيد في إيميلك" });
  const inlineError = page.getByRole("alert");

  const result = await Promise.race([
    page
      .waitForURL((url) => !url.pathname.startsWith("/auth/login"), { timeout: 30_000 })
      .then(() => ({ kind: "session" }) as const),
    confirmScreen
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => ({ kind: "confirm-required" }) as const),
    inlineError
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(async () => ({
        kind: "error" as const,
        message: (await inlineError.innerText()).trim(),
      })),
  ]);

  return result;
}

/** Sign in with the standard login form and wait to land outside /auth. */
export async function signInViaForm(page: Page, identity: TestIdentity): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("الإيميل").fill(identity.email);
  await page.getByLabel("كلمة المرور").fill(identity.password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
    timeout: 30_000,
  });
}
