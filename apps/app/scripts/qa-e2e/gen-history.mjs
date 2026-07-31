// Dump an account's full generation history: every plan_generations row with its
// real status/cost/duration, plus the current plan's per-member day fill.
//
// Exists because the KILLED runs are invisible in every aggregate the app has —
// plan_generations.cost_usd stays NULL and status stays 'started' forever, so the
// admin cost view and /api/plans/status both under-report exactly the runs that
// cost the most. Reading the rows directly is the only honest account.
//
//   node gen-history.mjs <email>

import { createClient } from "@supabase/supabase-js";
import { discoverSupabaseCreds, PASSWORD } from "./creds.mjs";

const email = process.argv[2];
if (!email) {
  console.error("usage: node gen-history.mjs <email>");
  process.exit(1);
}

const creds = await discoverSupabaseCreds();
const sb = createClient(creds.url, creds.anon);
const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
if (error) throw new Error(`sign-in failed: ${error.message}`);
const userId = auth.user.id;

const { data: gens } = await sb
  .from("plan_generations")
  .select("*")
  .eq("user_id", userId)
  .order("started_at", { ascending: true });

console.log(`\n=== plan_generations (${gens?.length ?? 0}) ===`);
for (const g of gens ?? []) {
  const dur = g.duration_ms != null ? `${Math.round(g.duration_ms / 1000)}s` : "—";
  // completed_at is NULL on a killed run, so derive the wall clock we actually
  // observed rather than trusting duration_ms (which is only written on exit).
  const wall = g.completed_at
    ? `${Math.round((Date.parse(g.completed_at) - Date.parse(g.started_at)) / 1000)}s`
    : "unwritten";
  console.log(
    [
      g.started_at?.slice(11, 19),
      (g.plan_kind ?? "meal").padEnd(7),
      g.status.padEnd(9),
      `dur=${dur}`.padEnd(11),
      `wall=${wall}`.padEnd(15),
      `cost=${g.cost_usd ?? g.estimated_cost_usd ?? "NULL"}`.padEnd(14),
      `in=${g.tokens_in ?? g.ai_input_tokens ?? "?"} out=${g.tokens_out ?? g.ai_output_tokens ?? "?"}`,
      g.error_message ? `| ${String(g.error_message).slice(0, 90)}` : "",
    ].join(" "),
  );
}

const started = (gens ?? []).filter((g) => g.status === "started");
const nullCost = (gens ?? []).filter((g) => g.cost_usd == null);
console.log(
  `\nrows stuck at 'started': ${started.length}` +
    ` | rows with NULL cost_usd (invisible to admin): ${nullCost.length}/${gens?.length ?? 0}`,
);

const { data: plans } = await sb
  .from("meal_plans")
  .select("id,status,created_at,updated_at,error_message,plan_data")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(1);
const p = plans?.[0];
if (p) {
  const pd = p.plan_data ?? {};
  console.log(`\n=== meal_plans (latest) ===`);
  console.log(
    `id=${p.id.slice(0, 8)} status=${p.status} generating=${pd.generating}` +
      ` days_total=${pd.days_total} updated=${p.updated_at?.slice(11, 19)}` +
      (p.error_message ? ` err=${String(p.error_message).slice(0, 80)}` : ""),
  );
  for (const m of pd.members ?? []) {
    const filled = (m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length;
    console.log(
      `  ${(m.member_name_ar ?? m.member_id).padEnd(10)} ${filled}/${(m.days ?? []).length} days` +
        ` | ${m.daily_calories_target} kcal${m.is_child ? " (child)" : ""}`,
    );
  }
}

const { data: mem } = await sb
  .from("family_members")
  .select("name,member_type,role,birth_year")
  .eq("user_id", userId)
  .order("display_order");
console.log(`\n=== family_members (${mem?.length ?? 0}) ===`);
for (const m of mem ?? []) console.log(`  ${m.name} / ${m.member_type} / ${m.role} / ${m.birth_year}`);
