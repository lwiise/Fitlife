// Diagnostic: summarize a generated plan — the skeleton's calorie/macro targets
// against each day's ACTUAL totals, the dish list, and a dislike/allergen scan.
//
// Reading the deviation columns: calories are enforced twice (band re-rolls, then
// a deterministic rescale in plan-engine), so a column of exact 0.0% means the
// rescale did the work, not the model. Protein has a band but no rescale, and
// carbs/fat have neither — so those columns are where real drift shows up.
//
// Usage: node analyze.mjs <email> [comma,separated,terms]
import { writeFileSync } from "node:fs";
import { signInAs } from "./creds.mjs";

const email = process.argv[2];
const terms = (process.argv[3] ?? "").split(",").map((t) => t.trim()).filter(Boolean);
if (!email) {
  console.error("usage: node analyze.mjs <email> [comma,separated,terms]");
  process.exit(1);
}

const { sb, userId } = await signInAs(email);
const { data: plans } = await sb
  .from("meal_plans")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(1);

const plan = plans?.[0];
if (!plan) {
  console.error("no meal plan for this account");
  process.exit(1);
}
const pd = plan.plan_data ?? {};
writeFileSync(new URL("./plan-dump.json", import.meta.url), JSON.stringify(pd, null, 2));

console.log(`plan ${plan.id}`);
console.log(`status=${plan.status} generating=${pd.generating} generated_at=${plan.generated_at}`);
console.log(
  `ai_model=${plan.ai_model} in=${plan.ai_input_tokens} out=${plan.ai_output_tokens} secs=${plan.ai_generation_seconds}`,
);
if (pd.week_start_date) console.log(`week_start_date=${pd.week_start_date}`);

const pct = (actual, target) => (target ? (((actual - target) / target) * 100).toFixed(1) : "—");

for (const m of pd.members ?? []) {
  const t = m.macros_target ?? {};
  console.log(`\n===== ${m.member_name_ar ?? m.member_id} (${m.member_id}) goal=${m.primary_goal} =====`);
  console.log(`TARGET: ${m.daily_calories_target} kcal | P ${t.protein_g}g C ${t.carbs_g}g F ${t.fat_g}g`);
  console.log("\nday | meals | kcal (Δ%)       | P g (Δ%)       | C g   | F g");
  for (const d of m.days ?? []) {
    const dt = d.day_total ?? {};
    console.log(
      `${String(d.day_index).padEnd(3)} | ${String((d.meals ?? []).length).padEnd(5)} | ` +
        `${String(dt.calories ?? 0).padStart(5)} (${String(pct(dt.calories, m.daily_calories_target)).padStart(7)}%) | ` +
        `${String(dt.protein_g ?? 0).padStart(5)} (${String(pct(dt.protein_g, t.protein_g)).padStart(7)}%) | ` +
        `${String(dt.carbs_g ?? 0).padStart(5)} | ${String(dt.fat_g ?? 0).padStart(5)}`,
    );
  }
  console.log("\n  dishes by day:");
  for (const d of m.days ?? []) {
    const names = (d.meals ?? [])
      .map((x) => `${x.slot_name_ar ?? x.slot}:${x.recipe_name_ar}`)
      .join("  •  ");
    console.log(`   d${d.day_index} (${d.day_name_ar ?? "?"}): ${names || "— EMPTY —"}`);
  }
}

if (terms.length) {
  console.log("\n===== dislike / allergen scan =====");
  const blob = JSON.stringify(pd);
  for (const term of terms) {
    const hits = [];
    for (const m of pd.members ?? []) {
      for (const d of m.days ?? []) {
        for (const meal of d.meals ?? []) {
          if (JSON.stringify(meal).includes(term)) {
            hits.push(`d${d.day_index} ${meal.slot_name_ar ?? meal.slot}: ${meal.recipe_name_ar}`);
          }
        }
      }
    }
    console.log(`"${term}": ${hits.length === 0 ? "CLEAN — not present" : `${hits.length} HIT(S)`}`);
    hits.forEach((h) => console.log(`    ${h}`));
    console.log(
      `   (raw occurrences anywhere in plan_data, incl. notes: ${(blob.match(new RegExp(term, "g")) ?? []).length})`,
    );
  }
}

console.log("\nwrote plan-dump.json");
