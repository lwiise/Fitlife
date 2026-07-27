// Watch a LIVE generation and emit a line only when something actually changes.
//
// The engine persists a full plan snapshot after each completed day, so a moving
// meal_plans.updated_at means a day landed and a static one means the run is
// stuck inside a single day's retry budget. That is the only progress signal
// available without Netlify's function logs.
//
// Emits on CHANGE, not on a timer, so the output is the run's actual shape.
//
//   node watch-gen.mjs <email> [maxMinutes]

import { createClient } from "@supabase/supabase-js";
import { discoverSupabaseCreds, PASSWORD } from "./creds.mjs";

const email = process.argv[2];
const MAX_MIN = Number(process.argv[3] ?? 20);
if (!email) {
  console.error("usage: node watch-gen.mjs <email> [maxMinutes]");
  process.exit(1);
}

const creds = await discoverSupabaseCreds();
const sb = createClient(creds.url, creds.anon);
const { data: auth, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
if (error) {
  console.error(`sign-in failed: ${error.message}`);
  process.exit(1);
}
const userId = auth.user.id;

const t0 = Date.now();
let last = "";

for (let i = 0; i < (MAX_MIN * 60) / 20; i++) {
  const { data: gens } = await sb
    .from("plan_generations")
    .select("plan_kind,status,duration_ms,cost_usd,error_message")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);
  const { data: plans } = await sb
    .from("meal_plans")
    .select("status,plan_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const g = gens?.[0];
  const pd = plans?.[0]?.plan_data;
  const per = (pd?.members ?? []).map(
    (m) => `${m.member_name_ar ?? m.member_id}:${(m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length}`,
  );
  const el = Math.round((Date.now() - t0) / 1000);
  const line = `${per.join(" ")} generating=${pd?.generating}`;

  if (line !== last) {
    console.log(`+${el}s  ${line}`);
    last = line;
  }

  if (g && (g.status === "completed" || g.status === "failed")) {
    console.log(
      `TERMINAL after ${el}s: ${g.status}` +
        ` | ${Math.round((g.duration_ms ?? 0) / 1000)}s | $${g.cost_usd ?? "?"}` +
        (g.error_message ? ` | ${g.error_message}` : ""),
    );
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 20_000));
}
// Netlify's hard kill leaves the row at 'started' forever — nothing sweeps it
// until the NEXT dispatch reclassifies it, so say so rather than implying it ran on.
console.log(`STILL 'started' after ${MAX_MIN}m — consistent with the worker being killed at its budget`);
