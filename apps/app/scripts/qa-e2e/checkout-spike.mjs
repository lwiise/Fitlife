// Spike: is Lemonsqueezy TEST-MODE checkout usable from the harness?
//
// This is the single largest unknown in the full-matrix run: every multi-member
// household needs a paid subscription (starter trial caps at max_people: 1), and
// the store is in test mode. Rather than build the whole matrix and discover at
// run time that checkout is a dead end, this answers it for ~$0 — it creates ONE
// account and NEVER triggers a generation.
//
// It reports, in order: does /api/checkout return a URL, does the LS page load,
// and what fields does that page actually present. Everything else in Group A
// depends on the answer.
//
//   node checkout-spike.mjs [--tier=pro] [--keep]

import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { discoverSupabaseCreds, BASE, PASSWORD } from "./creds.mjs";

const arg = (k) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const TIER = arg("tier") ?? "pro";
const KEEP = process.argv.includes("--keep");
const EMAIL = `fitlife.qa+ckspike-${Math.random().toString(36).slice(2, 10)}@gmail.com`;

const log = (m) => console.log(m);

async function main() {
  const creds = await discoverSupabaseCreds();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({ locale: "ar-SA" });
  const page = await ctx.newPage();

  // Capture what /api/checkout actually answers — the most diagnostic signal
  // here. A 200 with a URL means the variant ids resolve; anything else means
  // checkout is misconfigured and no amount of form-filling will help.
  let checkoutApi = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/checkout")) {
      checkoutApi = { status: res.status(), body: await res.text().catch(() => "") };
    }
  });

  log(`email: ${EMAIL}`);

  // 1. Real UI signup (so the app writes its own session cookies).
  await page.goto(`${BASE}/auth/login?mode=signup`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  if (new URL(page.url()).pathname.startsWith("/auth/login")) {
    const confirm = await page.getByText("رسالة التأكيد في إيميلك").count();
    throw new Error(confirm ? "BLOCKED — email confirmation is ON" : "signup failed");
  }
  log("1. signup ....................... session");

  // 2. Mark onboarding complete via PostgREST so /pricing is reachable. Minimal
  //    columns only — this account never generates, it only proves checkout.
  const sb = createClient(creds.url, creds.anon);
  const { data: auth, error: sErr } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (sErr) throw new Error(`sign-in failed: ${sErr.message}`);
  const userId = auth.user.id;
  const now = new Date().toISOString();
  const { error: pErr } = await sb
    .from("profiles")
    .update({
      display_name: "سبايك",
      sex: "female",
      birth_year: 1990,
      height_cm: 165,
      weight_kg: 72,
      activity_level: "light",
      primary_goal: "fat_loss",
      cuisine_preference: "khaleeji",
      family_wide_completed_at: now,
      mom_profile_completed_at: now,
      onboarding_completed_at: now,
    })
    .eq("id", userId);
  if (pErr) throw new Error(`profile write failed: ${pErr.message}`);
  log(`2. onboarding marked complete ... ${userId}`);

  // 3. /pricing and click the paid tier.
  await page.goto(`${BASE}/pricing?from=onboarding`, { waitUntil: "networkidle" });
  const buttons = await page.getByRole("button", { name: /اختاري/ }).all();
  log(`3. /pricing ..................... ${buttons.length} paid CTA(s)`);
  if (buttons.length === 0) {
    log("   ✗ no «اختاري …» button — cannot start checkout");
    if (!KEEP) log(`   account left behind: ${EMAIL}`);
    await browser.close();
    return;
  }

  const before = page.url();
  await buttons[0].click();
  await page.waitForTimeout(12_000); // LS redirect is a hard navigation

  log(`4. /api/checkout ................ ${checkoutApi ? checkoutApi.status : "NO CALL OBSERVED"}`);
  if (checkoutApi && checkoutApi.status !== 200) {
    log(`   body: ${checkoutApi.body.slice(0, 300)}`);
  }

  const landed = page.url();
  log(`5. landed on .................... ${landed.slice(0, 110)}`);
  if (landed === before) {
    log("   ✗ never navigated — checkout did not start");
  } else if (/lemonsqueezy|lmsqueezy/.test(landed)) {
    log("   ✓ reached the Lemonsqueezy hosted checkout");
    // What does the form actually present? Determines what checkout.mjs fills.
    const fields = await page.evaluate(() =>
      [...document.querySelectorAll("input,iframe")]
        .map((el) =>
          el.tagName === "IFRAME"
            ? `iframe[${(el.getAttribute("title") || el.getAttribute("name") || "?").slice(0, 40)}]`
            : `input[${el.getAttribute("name") || el.getAttribute("id") || el.type}]`,
        )
        .slice(0, 25),
    );
    log(`   fields: ${fields.join(", ") || "(none found)"}`);
    const testMode = await page
      .getByText(/test mode/i)
      .count()
      .catch(() => 0);
    log(`   test-mode banner: ${testMode > 0 ? "YES (test store confirmed)" : "not detected"}`);
  } else {
    log(`   ? unexpected destination`);
  }

  await page.screenshot({ path: "checkout-spike.png", fullPage: true }).catch(() => {});
  log(`\naccount: ${EMAIL} (delete with: node cleanup.mjs ${EMAIL})`);
  await browser.close();
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e.message);
  process.exit(1);
});
