// Consolidated verification across every persona account: what the wizard
// actually PERSISTED, what generation produced, and whether the gates behaved.
//
// Usage: node qa-report.mjs
import { signInAs } from "./creds.mjs";
import { PERSONAS } from "./personas.mjs";

const PROFILE_COLS = [
  "display_name", "sex", "member_type", "birth_year", "height_cm", "weight_kg",
  "target_weight_kg", "activity_level", "primary_goal", "cuisine_preference",
  "is_pregnant", "pregnancy_trimester", "pregnancy_month", "high_risk_pregnancy",
  "months_postpartum", "feeding_mode", "medical_conditions", "has_medical_conditions",
  "consulted_doctor", "allergies", "dislikes", "meals_per_day", "cooking_methods",
  "workout_profile", "mom_profile_completed_at", "onboarding_completed_at",
  "family_wide_completed_at",
];

const rows = [];
for (const p of PERSONAS) {
  const out = { key: p.key, email: p.email, label: p.label, expect: p.expect };
  let sb, userId;
  try {
    ({ sb, userId } = await signInAs(p.email));
  } catch {
    out.error = "sign-in failed (account missing?)";
    rows.push(out);
    continue;
  }
  out.userId = userId;

  const { data: prof } = await sb.from("profiles").select("*").eq("id", userId).single();
  out.profile = Object.fromEntries(PROFILE_COLS.map((c) => [c, prof?.[c] ?? null]));

  const { data: members } = await sb
    .from("family_members").select("name,role,member_type,preferred_language,birth_year,meal_mode")
    .eq("user_id", userId).order("display_order");
  out.members = members ?? [];

  const { data: gens } = await sb
    .from("plan_generations")
    .select("plan_kind,status,started_at,completed_at,duration_ms,tokens_in,tokens_out,cost_usd,error_message")
    .eq("user_id", userId).order("started_at");
  out.generations = gens ?? [];

  const { data: plans } = await sb
    .from("meal_plans").select("id,status,generated_at,plan_data,error_message")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  const plan = plans?.[0];
  if (plan) {
    const pd = plan.plan_data ?? {};
    out.plan = {
      status: plan.status,
      generating: pd.generating,
      error: plan.error_message,
      members: (pd.members ?? []).map((m) => ({
        member_id: m.member_id,
        target_kcal: m.daily_calories_target,
        macros: m.macros_target,
        goal: m.primary_goal,
        filled: (m.days ?? []).filter((d) => (d.meals ?? []).length > 0).length,
        total: (m.days ?? []).length,
        emptyDays: (m.days ?? []).filter((d) => (d.meals ?? []).length === 0).map((d) => d.day_index),
      })),
    };
  }

  const { data: wplans } = await sb
    .from("workout_plans").select("status,plan_data").eq("user_id", userId).limit(1);
  const wp = wplans?.[0];
  if (wp) {
    const m = (wp.plan_data?.members ?? [])[0];
    out.workout = {
      status: wp.status,
      split: m?.split_name_ar,
      sessions: (m?.weekly_sessions ?? []).length,
      days: (m?.weekly_sessions ?? []).map((s) => s.day_index),
      exercises: (m?.weekly_sessions ?? []).flatMap((s) => (s.exercises ?? []).map((e) => e.exercise_id)),
    };
  }
  rows.push(out);
}

// ── print ──
for (const r of rows) {
  console.log(`\n${"=".repeat(78)}\n${r.key}  ${r.email}\n${r.label}`);
  console.log(`expected: ${r.expect}`);
  if (r.error) { console.log(`  !! ${r.error}`); continue; }
  const p = r.profile;
  console.log(`  sex=${p.sex} type=${p.member_type} birth=${p.birth_year} goal=${p.primary_goal} activity=${p.activity_level}`);
  console.log(`  pregnant=${p.is_pregnant} month=${p.pregnancy_month} trim=${p.pregnancy_trimester} highrisk=${p.high_risk_pregnancy} mpp=${p.months_postpartum} feeding=${p.feeding_mode}`);
  console.log(`  conditions=${JSON.stringify(p.medical_conditions)} hasMedical=${p.has_medical_conditions} doctor=${p.consulted_doctor}`);
  console.log(`  dislikes=${JSON.stringify(p.dislikes)} meals/day=${p.meals_per_day} cuisine=${p.cuisine_preference}`);
  console.log(`  onboarding_done=${!!p.onboarding_completed_at} family_wide=${!!p.family_wide_completed_at} workout_profile=${p.workout_profile ? "set" : "null"}`);
  if (r.members.length) {
    console.log(`  members (${r.members.length}):`);
    r.members.forEach((m) => console.log(`     ${m.name} role=${m.role} type=${m.member_type} lang=${m.preferred_language} birth=${m.birth_year} mode=${m.meal_mode}`));
  } else {
    console.log(`  members: none`);
  }
  for (const g of r.generations) {
    console.log(`  GEN[${g.plan_kind}] ${g.status} dur=${g.duration_ms ? (g.duration_ms / 1000).toFixed(0) + "s" : "—"} in=${g.tokens_in} out=${g.tokens_out} cost=${g.cost_usd}${g.error_message ? ` err=${g.error_message.slice(0, 120)}` : ""}`);
  }
  if (r.plan) {
    console.log(`  PLAN status=${r.plan.status} generating=${r.plan.generating}${r.plan.error ? ` err=${r.plan.error}` : ""}`);
    r.plan.members.forEach((m) =>
      console.log(`     ${m.member_id}: ${m.filled}/${m.total} days${m.emptyDays.length ? ` EMPTY=[${m.emptyDays}]` : ""} target=${m.target_kcal}kcal goal=${m.goal} P${m.macros?.protein_g}/C${m.macros?.carbs_g}/F${m.macros?.fat_g}`),
    );
  } else {
    console.log(`  PLAN: none`);
  }
  if (r.workout) {
    console.log(`  WORKOUT ${r.workout.status} «${r.workout.split}» sessions=${r.workout.sessions} days=[${r.workout.days}]`);
    console.log(`     exercises: ${[...new Set(r.workout.exercises)].join(", ")}`);
  }
}
console.log(`\n${"=".repeat(78)}\ntotal cost across accounts: $${rows.flatMap((r) => r.generations ?? []).reduce((s, g) => s + Number(g.cost_usd ?? 0), 0).toFixed(4)}`);
