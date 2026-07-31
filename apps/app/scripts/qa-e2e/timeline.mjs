// Diagnostic: poll a live generation and log exactly WHEN each day lands.
//
// This is the substitute for Netlify function logs. The background function
// persists a full snapshot on every completed day (plan-engine's `emit()`), so a
// moving meal_plans.updated_at means a day landed and a static one means the run
// is stuck inside a single day's retry budget. That distinction is the whole
// diagnosis for a slow generation, and it is visible from the DB alone.
//
// Usage: node timeline.mjs <email> [minutes]
import { signInAs } from "./creds.mjs";

const email = process.argv[2];
const minutes = Number(process.argv[3] ?? 25);
if (!email) {
  console.error("usage: node timeline.mjs <email> [minutes]");
  process.exit(1);
}

const POLL_MS = 15_000;
const ts = () => new Date().toISOString().slice(11, 19);
const { sb, userId } = await signInAs(email);
console.log(`${ts()} timeline start for ${email}`);

let prevSignature = null;
const deadline = Date.now() + minutes * 60_000;

while (Date.now() < deadline) {
  const { data: plans } = await sb
    .from("meal_plans")
    .select("id,status,updated_at,generated_at,plan_data,error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: gens } = await sb
    .from("plan_generations")
    .select("status,started_at,completed_at,tokens_in,tokens_out,cost_usd,duration_ms,error_message")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);

  const plan = plans?.[0];
  const gen = gens?.[0];
  if (!plan) {
    console.log(`${ts()} (no plan row yet)`);
    await new Promise((r) => setTimeout(r, POLL_MS));
    continue;
  }

  const pd = plan.plan_data ?? {};
  const fill = (pd.members ?? [])
    .map((m) => {
      const days = m.days ?? [];
      return `${days.filter((d) => (d.meals ?? []).length > 0).length}/${days.length}`;
    })
    .join(",");
  const signature = `${plan.status}|${pd.generating}|${fill}|${gen?.status}`;

  if (signature !== prevSignature) {
    console.log(
      `${ts()} plan=${plan.status} generating=${pd.generating} daysFilled=[${fill}] ` +
        `gen=${gen?.status} upd=${plan.updated_at?.slice(11, 19)}`,
    );
    if (plan.error_message) console.log(`${ts()}   plan error: ${plan.error_message}`);
    prevSignature = signature;
  }

  // The generation row is the authoritative finish line: plan_data flips
  // generating=false BEFORE the engine's second-chance retry wave and before the
  // final token/cost write, so "generating: false" alone does NOT mean the
  // background function is done.
  if (gen?.status && gen.status !== "started") {
    console.log(
      `${ts()} GEN SETTLED: ${gen.status} tokens_in=${gen.tokens_in} ` +
        `tokens_out=${gen.tokens_out} cost=${gen.cost_usd} duration_ms=${gen.duration_ms}`,
    );
    if (gen.error_message) console.log(`${ts()}   cause: ${gen.error_message}`);
    break;
  }
  if (plan.status === "failed") {
    console.log(`${ts()} PLAN FAILED`);
    break;
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
console.log(`${ts()} timeline end`);
