// Diagnostic: report a QA account's plan_generations + meal_plans state.
//
// The point is TRUE generation timing. The harness only sees wall-clock from its
// own trigger; plan_generations.started_at → completed_at is what the run
// actually took, and its error_message carries the partial-day cause.
//
// Usage: node probe.mjs <email> [--full]
import { writeFileSync } from "node:fs";
import { signInAs } from "./creds.mjs";

const email = process.argv[2];
const full = process.argv.includes("--full");
if (!email) {
  console.error("usage: node probe.mjs <email> [--full]");
  process.exit(1);
}

const { sb, userId, user } = await signInAs(email);
console.log(`user ${userId}  (${email})`);
console.log(`created_at ${user.created_at}`);

const { data: gens, error: gErr } = await sb
  .from("plan_generations")
  .select("*")
  .eq("user_id", userId)
  .order("started_at", { ascending: true });

if (gErr) {
  console.log("plan_generations error:", gErr.message);
} else {
  console.log(`\n=== plan_generations (${gens.length}) ===`);
  for (const g of gens) {
    const durationSec = g.completed_at
      ? `${((Date.parse(g.completed_at) - Date.parse(g.started_at)) / 1000).toFixed(0)}s`
      : `OPEN (${((Date.now() - Date.parse(g.started_at)) / 1000).toFixed(0)}s so far)`;
    console.log(
      JSON.stringify(
        {
          id: g.id,
          kind: g.plan_kind,
          status: g.status,
          started_at: g.started_at,
          completed_at: g.completed_at,
          duration: durationSec,
          duration_ms: g.duration_ms,
          model: g.model,
          tokens_in: g.tokens_in,
          tokens_out: g.tokens_out,
          cost_usd: g.cost_usd,
          error_message: g.error_message,
          meal_plan_id: g.meal_plan_id,
          workout_plan_id: g.workout_plan_id,
        },
        null,
        1,
      ),
    );
  }
}

const META =
  "id,status,created_at,updated_at,generated_at,ai_model,ai_input_tokens,ai_output_tokens,ai_generation_seconds,error_message";
const { data: plans, error: pErr } = await sb
  .from("meal_plans")
  .select(full ? "*" : META)
  .eq("user_id", userId)
  .order("created_at", { ascending: true });

if (pErr) {
  console.log("meal_plans error:", pErr.message);
} else {
  console.log(`\n=== meal_plans (${plans.length}) ===`);
  for (const p of plans) {
    const { plan_data, ...meta } = p;
    console.log(JSON.stringify(meta, null, 1));
    if (!full || !plan_data) continue;
    console.log(`  generating=${plan_data.generating}`);
    for (const m of plan_data.members ?? []) {
      const days = m.days ?? [];
      const filled = days.filter((d) => (d.meals ?? []).length > 0).length;
      console.log(`  member ${m.member_id}: ${filled}/${days.length} days filled`);
      for (const d of days) {
        const n = (d.meals ?? []).length;
        console.log(`    d${d.day_index} ${n} meals${n ? "" : "  (EMPTY)"}`);
      }
    }
  }
  if (full && plans.length) {
    writeFileSync(
      new URL("./probe-dump.json", import.meta.url),
      JSON.stringify(plans[plans.length - 1].plan_data, null, 2),
    );
    console.log("\nwrote probe-dump.json");
  }
}
