// Smoke test for the 07/2026 engineering-audit fixes.
//
// Each check names the finding it guards, so a failure tells you WHICH bug came
// back rather than just that something is wrong. Run it after deploying the
// audit branch and after applying migrations 00023 + 00024.
//
//   node audit-smoke.mjs <qa-account-email>
//
// Exit code is 1 if any check FAILS, so it can gate a deploy.
//
// SAFETY: this signs in as a REAL account and writes a small number of rows to
// prove the RLS policies behave. Everything it writes, it deletes — and if a
// cleanup fails it says so loudly. Point it at a QA account, never a customer's.
// The tamper checks are deliberately non-destructive: they re-write a row's
// CURRENT value, so "the write was allowed" is provable without changing data.
//
// What it CANNOT check, because it holds a Supabase session rather than the
// app's cookie session: anything behind a server action or an authenticated API
// route. Those are listed as a manual checklist at the end of the run.
import { signInAs, BASE } from "./creds.mjs";

const email = process.argv[2];
if (!email) {
  console.error("usage: node audit-smoke.mjs <qa-account-email>");
  process.exit(1);
}

const results = [];
const record = (id, title, state, detail) => {
  results.push({ id, title, state, detail });
  const mark = { PASS: "PASS", FAIL: "FAIL", SKIP: "skip", WARN: "warn" }[state];
  console.log(`  [${mark}] ${id} — ${title}${detail ? `\n         ${detail}` : ""}`);
};

const { sb, userId } = await signInAs(email);
console.log(`\nsigned in as ${email}  (${userId})`);
console.log(`base ${BASE}\n`);

// ─── Schema / migration presence ───────────────────────────────────────────
console.log("Migrations 00023 + 00024");

{
  // 00024 §4. Selecting a column that does not exist is a hard PostgREST error,
  // which is exactly the signal we want.
  const { error } = await sb
    .from("subscriptions")
    .select("last_event_at")
    .eq("user_id", userId)
    .limit(1);
  record(
    "00024",
    "subscriptions.last_event_at exists (webhook ordering guard)",
    error ? "FAIL" : "PASS",
    error?.message,
  );
}

{
  // 00024 §3. The read path has always assumed one row; the webhook wrote to all
  // of them. More than one here means the unique index did not land.
  const { count, error } = await sb
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) record("H5", "exactly one subscriptions row per user", "SKIP", error.message);
  else
    record(
      "H5",
      "exactly one subscriptions row per user",
      count === 1 ? "PASS" : "FAIL",
      `rows=${count}`,
    );
}

// ─── C1: clearing a verdict must actually delete ───────────────────────────
console.log("\nRLS delete policies");

{
  const { data: plans } = await sb
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1);
  const planId = plans?.[0]?.id;

  if (!planId) {
    record("C1", "meal_verdicts DELETE policy", "SKIP", "account has no meal plan to key a verdict to");
  } else {
    // day_index 6 / a sentinel slot keeps this clear of anything the UI wrote.
    const probe = {
      user_id: userId,
      meal_plan_id: planId,
      member_id: "mom",
      day_index: 6,
      slot: "__audit_smoke__",
      recipe_name_ar: "فحص",
      canonical_key: "__audit_smoke__",
      verdict: "loved",
    };
    const { error: insErr } = await sb.from("meal_verdicts").insert(probe);
    if (insErr) {
      record("C1", "meal_verdicts DELETE policy", "SKIP", `could not insert probe: ${insErr.message}`);
    } else {
      const { error: delErr } = await sb
        .from("meal_verdicts")
        .delete()
        .eq("user_id", userId)
        .eq("meal_plan_id", planId)
        .eq("slot", "__audit_smoke__");
      const { count } = await sb
        .from("meal_verdicts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("slot", "__audit_smoke__");
      // THE bug: with no DELETE policy the statement affects zero rows and
      // returns NO error, so the app reports success and the verdict reappears.
      record(
        "C1",
        "meal_verdicts DELETE policy (clearing «كيف كانت؟» sticks)",
        count === 0 ? "PASS" : "FAIL",
        count === 0
          ? undefined
          : `probe row SURVIVED its delete (${count} left)${delErr ? ` — ${delErr.message}` : " with no error"}. Apply 00024 §1. Clean up slot='__audit_smoke__' manually.`,
      );
    }
  }
}

{
  // Same class, latent: body_logs has no delete path in the app yet.
  const probe = {
    user_id: userId,
    member_id: "__audit_smoke__",
    recorded_on: "2001-01-01",
    weight_kg: 70,
  };
  const { error: insErr } = await sb.from("body_logs").insert(probe);
  if (insErr) {
    record("C1b", "body_logs DELETE policy", "SKIP", `could not insert probe: ${insErr.message}`);
  } else {
    await sb
      .from("body_logs")
      .delete()
      .eq("user_id", userId)
      .eq("member_id", "__audit_smoke__");
    const { count } = await sb
      .from("body_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("member_id", "__audit_smoke__");
    record(
      "C1b",
      "body_logs DELETE policy",
      count === 0 ? "PASS" : "FAIL",
      count === 0 ? undefined : `probe row survived; clean up member_id='__audit_smoke__'`,
    );
  }
}

// ─── F5: plan_generations is an audit table the browser must not rewrite ────
console.log("\nAudit-table lockdown");

{
  const { data: gens } = await sb
    .from("plan_generations")
    .select("id, cost_usd")
    .eq("user_id", userId)
    .limit(1);
  const row = gens?.[0];
  if (!row) {
    record("F5", "plan_generations user UPDATE revoked", "SKIP", "no generation rows on this account");
  } else {
    // Non-destructive: write the CURRENT value back. If RLS allows the write,
    // .select() returns the row — proving write access without changing data.
    const { data: updated } = await sb
      .from("plan_generations")
      .update({ cost_usd: row.cost_usd })
      .eq("id", row.id)
      .select("id");
    const allowed = (updated?.length ?? 0) > 0;
    record(
      "F5",
      "plan_generations user UPDATE revoked (quota + cost tamper)",
      allowed ? "FAIL" : "PASS",
      allowed
        ? "the browser can still UPDATE its own audit rows — it can reset the weekly quota, clear the in-flight lock, and rewrite the cost columns the admin dashboards read. Apply 00024 §2 (and deploy the branch first — the reclassifier needs the service-role client)."
        : undefined,
    );
  }
}

// ─── Public surface: routing + the password-reset flow ─────────────────────
console.log("\nRouting and auth surface (unauthenticated)");

const getNoRedirect = (path) =>
  fetch(`${BASE}${path}`, { redirect: "manual" }).catch((e) => ({ error: e }));

{
  // [5] /pricing renders a logged-out variant on purpose; the proxy used to
  // gate it, making that branch unreachable and hiding prices from prospects.
  const res = await getNoRedirect("/pricing");
  const loc = res.headers?.get?.("location") ?? "";
  const gated = res.status >= 300 && res.status < 400 && loc.includes("/auth/login");
  record(
    "[5]",
    "/pricing is publicly reachable",
    res.error ? "SKIP" : gated ? "FAIL" : "PASS",
    res.error ? String(res.error) : gated ? `redirects to ${loc}` : `status ${res.status}`,
  );
}

{
  // M5: the asset test was `pathname.includes(".")`, so ANY route whose id held
  // a dot skipped the session refresh. A protected path must still gate.
  const res = await getNoRedirect("/plan/history/abc.def");
  const loc = res.headers?.get?.("location") ?? "";
  const gated = res.status >= 300 && res.status < 400 && loc.includes("/auth/login");
  record(
    "M5",
    "a dotted path is still auth-gated (proxy asset matcher)",
    res.error ? "SKIP" : gated ? "PASS" : "FAIL",
    res.error ? String(res.error) : gated ? undefined : `expected a login redirect, got ${res.status} ${loc}`,
  );
}

{
  // F15: there was no reset path at all — a forgotten password was permanent
  // lockout of a paid account.
  const res = await fetch(`${BASE}/auth/login`).catch((e) => ({ error: e }));
  if (res.error) {
    record("F15", "password reset is offered on the login form", "SKIP", String(res.error));
  } else {
    const html = await res.text();
    const has = html.includes("نسيت كلمة المرور");
    record(
      "F15",
      "password reset is offered on the login form",
      has ? "PASS" : "FAIL",
      has ? undefined : "«نسيت كلمة المرور» not found in the served HTML — is the branch deployed?",
    );
  }
}

{
  // The recovery screen must EXIST (a logged-out hit gates to login, not 404).
  const res = await getNoRedirect("/auth/update-password");
  const missing = res.status === 404;
  record(
    "F15b",
    "/auth/update-password exists",
    res.error ? "SKIP" : missing ? "FAIL" : "PASS",
    res.error ? String(res.error) : `status ${res.status}`,
  );
}

// ─── Summary ───────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.state === "FAIL");
const skipped = results.filter((r) => r.state === "SKIP");
console.log(
  `\n${results.length} checks — ${results.filter((r) => r.state === "PASS").length} passed, ` +
    `${failed.length} failed, ${skipped.length} skipped`,
);
if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  ${f.id} — ${f.title}`);
}

console.log(`
Not automatable from here (needs the app's cookie session or the real UI):

  C1   /plan → mark a meal «طبختها كما هي», set a verdict, then tap the SAME
       verdict chip again. It must stay cleared after the page settles.
  H1   opt into workouts, start a workout generation, then immediately add a
       family member. The member must generate — not silently defer.
  H2   add one member past the tier cap. The member must NOT be saved, and the
       upgrade screen's CTA must land somewhere that can actually take payment.
  H6   from /subscription, downgrade below your household size. It must be
       refused, naming how many members to remove first.
  F12  as an EXISTING subscriber, follow the upgrade CTA. It must go to
       /subscription, not /pricing (which 409s you).
  G1   complete onboarding → pay → land back in the app. A plan must generate.
  F15  request a reset link, open it, set a new password, sign in with it.

Reminder: while NEXT_PUBLIC_FREE_ACCESS_MODE is on, getTierLimit returns null
for everyone, so H2 / H6 / F12 cannot be exercised at all.
`);

process.exit(failed.length ? 1 : 0);
