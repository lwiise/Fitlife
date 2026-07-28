// Buy a paid tier on a QA account with Lemonsqueezy's TEST card, then prove the
// subscription actually activated.
//
// Why this exists: signup grants a `starter` trial, which caps at max_people: 1
// (packages/config/src/pricing.ts). A household's members are STORED but only the
// owner's plan generates, so multi-member generation — shared meals, batch
// scaling, per-member targets — cannot be tested at all without a paid tier.
// `family` caps at 6, which covers every household size the matrix builds.
//
// SAFE: the store is in test mode, verified 2026-07-27 — the hosted checkout's
// order and variant objects both report `test_mode: true`. Card 4242…4242 only
// completes against a test-mode checkout; a live one would decline it. If this
// script ever starts succeeding against a live store, that is a store change, not
// a code change, so it re-checks the mode and REFUSES before touching the form.
//
//   node checkout.mjs <email> [--tier=family] [--cadence=monthly]

import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

import { BASE, PASSWORD, discoverSupabaseCreds } from "./creds.mjs";

const TEST_CARD = { number: "4242424242424242", exp: "12 / 30", cvc: "123" };

const email = process.argv[2];
if (!email || email.startsWith("--")) {
  console.error("usage: node checkout.mjs <email> [--tier=family] [--cadence=monthly]");
  process.exit(1);
}
const arg = (k) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
const TIER = arg("tier") ?? "family";
const TIER_LABEL_AR = { starter: "البداية", pro: "المتقدمة", family: "العائلة", premium: "البريميوم" }[TIER];

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

/**
 * The checkout page embeds the order and variant as JSON. `test_mode` on THOSE is
 * the payment mode. `isTestMode` is the Lemonsqueezy dashboard viewer's session
 * flag and is false for any anonymous visitor — reading it as the mode is exactly
 * the mistake that once had this repo believing a test store was live.
 */
async function assertTestMode(url) {
  const html = (await (await fetch(url, { signal: AbortSignal.timeout(30_000) })).text()).replace(
    /&quot;/g,
    '"',
  );
  const flags = [...html.matchAll(/"test_mode":(true|false)/g)].map((m) => m[1]);
  if (flags.length === 0) throw new Error("could not read test_mode off the checkout page");
  if (flags.some((f) => f === "false")) {
    throw new Error(`REFUSING: a test_mode:false object is present (${flags.join(",")}) — this may charge a real card`);
  }
  return flags.length;
}

const creds = await discoverSupabaseCreds();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
// en-US on PURPOSE. Lemonsqueezy localises its hosted checkout, and with an
// ar-SA context it served BULGARIAN — which is also why the first mode probe
// missed the test-mode banner («В момента е активиран тестовият режим») while
// grepping for the English string. Our own app is not being tested here, so a
// predictable language beats a representative one.
const ctx = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 1000 } });
// Keep the consent ask out of the way — it is answered in its own targeted test.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("fitlife_cookie_consent", "declined");
  } catch {
    /* private mode */
  }
});
const page = await ctx.newPage();

let checkoutUrl = null;
page.on("response", async (r) => {
  if (r.url().includes("/api/checkout")) {
    const body = await r.text().catch(() => "");
    try {
      checkoutUrl = JSON.parse(body).checkout_url ?? null;
    } catch {
      /* non-JSON */
    }
  }
});

try {
  // 1. Sign in.
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 60_000 }).catch(() => null),
  ]);
  if (new URL(page.url()).pathname.startsWith("/auth/login")) throw new Error("sign-in failed");
  log(`signed in → ${page.url()}`);

  // 2. Start checkout for the tier.
  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
  const cta = page.getByRole("button", { name: new RegExp(`اختاري\\s*${TIER_LABEL_AR}`) });
  if ((await cta.count()) === 0) throw new Error(`no «اختاري ${TIER_LABEL_AR}» button on /pricing`);
  await cta.first().click();
  await page.waitForURL(/lemonsqueezy|lmsqueezy/, { timeout: 60_000 });
  log(`hosted checkout: ${page.url().slice(0, 90)}`);

  // 3. REFUSE unless the store is genuinely in test mode.
  const n = await assertTestMode(checkoutUrl ?? page.url());
  log(`test-mode check: ${n} commerce object(s), all test_mode:true — safe to fill`);

  // 4. Fill the hosted form.
  await page.waitForTimeout(3000);

  // Cadence: the form defaults to Annual. Pick the monthly plan so the
  // subscription row carries cadence="monthly" like a normal customer's.
  const monthly = page.getByText(/^Monthly$/).first();
  if (await monthly.count()) {
    await monthly.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  await page.locator('input[type="email"]').first().fill(email).catch(() => {});

  const frames = () => page.frames().filter((f) => /stripe/i.test(f.url()));
  log(`stripe frames: ${frames().length}`);
  for (const [sel, val] of [
    ['input[name="cardnumber"], input[name="number"]', TEST_CARD.number],
    ['input[name="exp-date"], input[name="expiry"]', TEST_CARD.exp],
    ['input[name="cvc"]', TEST_CARD.cvc],
  ]) {
    for (const f of frames()) {
      const el = f.locator(sel).first();
      if (await el.count().catch(() => 0)) {
        await el.fill(val).catch(() => {});
        break;
      }
    }
  }

  // Cardholder + billing address. LS blocks submission until the address is
  // valid FOR THE SELECTED COUNTRY — and the country select must be chosen by
  // LABEL. Picking it by index once landed on "Aland Islands" (alphabetically
  // second), and the run then failed on "The postal_code must be a valid postal
  // code" with a US ZIP in an Aland field.
  const holder = page.locator('input[name="card_holder_name"], input[placeholder*="Doe"]').first();
  if (await holder.count()) await holder.fill("QA Tester").catch(() => {});

  const country = page.locator("select").first();
  if (await country.count()) {
    await country.selectOption({ label: "Saudi Arabia" }).catch(async () => {
      await country.selectOption({ label: "United States" }).catch(() => {});
    });
    await page.waitForTimeout(1500); // the address fields re-render per country
  }
  for (const [sel, val] of [
    ['input[name="address_line_1"], input[placeholder*="Address"]', "1 Test Street"],
    ['input[name="city"], input[placeholder*="City"]', "Riyadh"],
    ['input[name="postal_code"], input[placeholder*="ZIP"], input[placeholder*="Post"]', "12345"],
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) await el.fill(val).catch(() => {});
  }

  await page.screenshot({ path: "checkout-filled.png", fullPage: true }).catch(() => {});

  // 5. Submit and wait for the return trip.
  // Language-agnostic: the checkout's submit button is the form's own submit,
  // whatever LS decided to call it. Matching on "Pay" missed the Bulgarian
  // «Плащане на 1236,00 SAR» and cost a whole run.
  let pay = page.locator('button[type="submit"]:visible').last();
  if ((await pay.count()) === 0) {
    pay = page.getByRole("button", { name: /Pay|Плащане|ادفع|Subscribe/i }).first();
  }
  if ((await pay.count()) === 0) throw new Error("no pay button found");
  log(`pay button: «${(await pay.textContent().catch(() => "?")).trim().slice(0, 40)}»`);
  await pay.click();
  log("submitted — waiting for redirect back…");
  await page.waitForTimeout(6000);
  const formErr = await page
    .locator("text=/must be|invalid|required|declined/i")
    .first()
    .textContent()
    .catch(() => null);
  if (formErr) log(`  form error: ${formErr.trim().slice(0, 120)}`);
  await page.waitForURL(/\/dashboard/, { timeout: 180_000 }).catch(() => null);
  log(`landed: ${page.url().slice(0, 90)}`);
  await page.waitForTimeout(35_000); // CheckoutSuccessHandler polls, then reconciles
  await page.screenshot({ path: "checkout-after.png", fullPage: true }).catch(() => {});

  // 6. Prove it: read the subscription row under the account's own JWT.
  const sb = createClient(creds.url, creds.anon);
  const { data: auth } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  const { data: subs } = await sb
    .from("subscriptions")
    .select("tier,status,cadence,current_period_end")
    .eq("user_id", auth.user.id);
  log(`subscriptions: ${JSON.stringify(subs)}`);
  const active = (subs ?? []).find((s) => s.tier === TIER && ["active", "trialing"].includes(s.status));
  log(active ? `✓ ${TIER} ACTIVE — multi-member generation unblocked` : `✗ no active ${TIER} row`);
  process.exitCode = active ? 0 : 2;
} catch (err) {
  log(`FAILED: ${err.message.split("\n")[0]}`);
  await page.screenshot({ path: "checkout-error.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
