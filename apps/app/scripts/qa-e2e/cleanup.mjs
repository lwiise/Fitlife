// Cleanup: hard-delete a QA account through the real /settings flow
// (login → «حذف حسابي» → type the email → «حذف نهائي»), then verify the account
// is really gone by attempting a password sign-in.
//
// Deletion goes through the UI on purpose: it exercises the same PDPL erasure
// path a customer would (POST /api/account/delete → eraseUserAccount), rather
// than deleting rows behind the app's back.
//
// Usage: node cleanup.mjs <email>
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { BASE, PASSWORD, discoverSupabaseCreds } from "./creds.mjs";

const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const email = process.argv[2];
if (!email) {
  console.error("usage: node cleanup.mjs <email>");
  process.exit(1);
}

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ locale: "ar-SA" });
const page = await ctx.newPage();
try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page
      .waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  ]);
  log(`logged in → ${page.url()}`);

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  const openBtn = page.getByRole("button", { name: /حذف حسابي/ });
  await openBtn.waitFor({ timeout: 30_000 });
  await openBtn.click();
  log("opened delete modal");

  await page.fill("#delete-confirm-email", email);
  await page.getByRole("button", { name: /حذف نهائي/ }).click();
  log("confirmed hard delete — waiting for completion…");
  await page
    .waitForURL((u) => !u.pathname.startsWith("/settings"), { timeout: 90_000 })
    .catch(() => null);
  log(`post-delete url: ${page.url()}`);
} finally {
  await ctx.close();
  await browser.close();
}

// Independent verification — the credentials must no longer authenticate.
const { url, anon } = await discoverSupabaseCreds();
const sb = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
if (error) log(`VERIFIED DELETED — sign-in now fails: ${error.message}`);
else log(`STILL EXISTS — signed in as ${data.user.id} (deletion did NOT work)`);
