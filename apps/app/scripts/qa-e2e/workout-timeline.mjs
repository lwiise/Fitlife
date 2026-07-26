// Watch a COMBINED (meals + workout) generation. Beyond the meal timeline this
// shows the two things unique to the workout fork: migration 00014's per-kind
// lock letting a meal run and a workout run hold 'started' at the same time,
// and the meals-first hold, where the workout function idles until the meal run
// settles so meals get the whole Anthropic budget.
//
// Usage: node workout-timeline.mjs <email> [minutes]
import { signInAs, BASE } from "./creds.mjs";

const email = process.argv[2];
const minutes = Number(process.argv[3] ?? 30);
if (!email) {
  console.error("usage: node workout-timeline.mjs <email> [minutes]");
  process.exit(1);
}
const POLL_MS = 15_000;
const ts = () => new Date().toISOString().slice(11, 19);
const { sb, userId } = await signInAs(email);
console.log(`${ts()} combined timeline for ${email}`);

let prev = null;
const deadline = Date.now() + minutes * 60_000;
while (Date.now() < deadline) {
  const [{ data: plans }, { data: workouts }, { data: gens }] = await Promise.all([
    sb.from("meal_plans").select("status,updated_at,plan_data").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1),
    sb.from("workout_plans").select("id,status,updated_at,plan_data").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1),
    sb.from("plan_generations").select("plan_kind,status,started_at,completed_at,tokens_in,tokens_out,cost_usd,duration_ms,error_message")
      .eq("user_id", userId).order("started_at", { ascending: true }),
  ]);

  const meal = plans?.[0];
  const wk = workouts?.[0];
  const mealGen = gens?.find((g) => g.plan_kind === "meal");
  const wkGen = gens?.find((g) => g.plan_kind === "workout");

  const mealFill = (meal?.plan_data?.members ?? [])
    .map((m) => `${(m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length}/${(m.days ?? []).length}`)
    .join(",");
  const wkMembers = wk?.plan_data?.members ?? [];
  const wkFill = wkMembers
    .map((m) => `${(m.sessions ?? []).filter((s) => (s.exercises ?? []).length > 0).length}/${(m.sessions ?? []).length}`)
    .join(",");

  const sig = `${meal?.status}|${meal?.plan_data?.generating}|${mealFill}|${mealGen?.status}|${wk?.status}|${wkFill}|${wkGen?.status}`;
  if (sig !== prev) {
    console.log(
      `${ts()} MEAL plan=${meal?.status ?? "—"} gen=${mealGen?.status ?? "—"} days=[${mealFill}]` +
        `   WORKOUT plan=${wk?.status ?? "—"} gen=${wkGen?.status ?? "—"} sessions=[${wkFill}]`,
    );
    prev = sig;
  }

  for (const g of gens ?? []) {
    if (g.status !== "started" && !g.__seen) {
      // Print a settle line once per kind, when it first appears terminal.
      const key = `settled_${g.plan_kind}`;
      if (!globalThis[key]) {
        globalThis[key] = true;
        console.log(
          `${ts()}   ${g.plan_kind.toUpperCase()} SETTLED: ${g.status} ` +
            `duration=${g.duration_ms ? (g.duration_ms / 1000).toFixed(0) + "s" : "—"} ` +
            `in=${g.tokens_in} out=${g.tokens_out} cost=${g.cost_usd}` +
            `${g.error_message ? ` err=${g.error_message}` : ""}`,
        );
      }
    }
  }

  const mealDone = mealGen && mealGen.status !== "started";
  const workoutDone = wkGen && wkGen.status !== "started";
  if (mealDone && workoutDone) {
    console.log(`${ts()} BOTH SETTLED`);
    break;
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
console.log(`${ts()} timeline end`);
