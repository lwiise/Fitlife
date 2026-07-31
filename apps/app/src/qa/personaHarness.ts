/**
 * QA harness (temporary): a fake Supabase client that serves a single
 * account's `profiles` row + `family_members` rows, shaped exactly like the
 * queries buildPlanContext makes. Lets the persona matrix drive the REAL
 * engine code (context build → medical gate → prompt) without a database.
 */

export interface FakeAccount {
  email: string;
  label: string;
  profile: Record<string, unknown>;
  members: Record<string, unknown>[];
}

type Row = Record<string, unknown>;

function makeQuery(rows: Row[], single: boolean) {
  const state = { rows: [...rows] };
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = chain;
  api.eq = chain;
  api.neq = chain;
  api.not = chain;
  api.order = chain;
  api.limit = chain;
  api.returns = chain;
  api.maybeSingle = async () => ({ data: state.rows[0] ?? null, error: null });
  api.single = async () =>
    state.rows[0]
      ? { data: state.rows[0], error: null }
      : { data: null, error: { message: "no rows" } };
  // Awaiting the builder itself resolves to the list form.
  api.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(
      single
        ? { data: state.rows[0] ?? null, error: null }
        : { data: state.rows, error: null },
    ).then(resolve);
  return api;
}

/** Minimal chainable stand-in for the queries buildPlanContext makes. */
export function fakeSupabase(account: FakeAccount) {
  return {
    from(table: string) {
      if (table === "profiles") return makeQuery([account.profile], true);
      if (table === "family_members") return makeQuery(account.members, false);
      return makeQuery([], false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** A profiles row with every column the code reads, defaulted the way the DB
 * defaults it for a brand-new signup. Personas override only what they answer. */
export function baseProfile(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mom",
    display_name: "سارة",
    preferred_language: "ar",
    sex: "female",
    member_type: "adult",
    birth_year: 1990,
    height_cm: 162,
    weight_kg: 74,
    waist_cm: null,
    hip_cm: null,
    activity_level: "light",
    primary_goal: "fat_loss",
    cuisine_preference: "khaleeji",
    dietary_restrictions: [],
    has_medical_conditions: false,
    medical_conditions: [],
    is_pregnant: false,
    pregnancy_trimester: null,
    pregnancy_month: null,
    consulted_doctor: false,
    onboarding_completed_at: "2026-07-20T00:00:00.000Z",
    family_wide_completed_at: null,
    mom_profile_completed_at: "2026-07-20T00:00:00.000Z",
    allergies: [],
    dislikes: [],
    liked_foods: [],
    never_eat_foods: [],
    months_postpartum: null,
    high_risk_pregnancy: false,
    family_dietary_restrictions: [],
    family_dislikes: [],
    cooking_methods: [],
    meal_out_frequency: null,
    meal_mode: "shared",
    member_addition_order: [],
    target_weight_kg: null,
    day_nature: null,
    exercise_days: null,
    exercise_type: null,
    water_cups: null,
    water_liters: null,
    sleep_hours: null,
    sleep_band: null,
    stress_level: null,
    medications: [],
    supplements: [],
    nausea_foods: [],
    notes: null,
    feeding_mode: null,
    meals_per_day: null,
    intermittent_fasting: null,
    food_recall_24h: null,
    previous_diets: null,
    steps_daily: null,
    exercise_duration: null,
    snacks_habit: null,
    breakfast_habit: null,
    sleep_quality: null,
    who_cooks: null,
    cooking_time: null,
    food_budget: null,
    workout_profile: null,
    ...over,
  };
}

let memberSeq = 0;
export function baseMember(over: Record<string, unknown> = {}): Record<string, unknown> {
  memberSeq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(memberSeq).padStart(12, "0")}`,
    user_id: "mom",
    name: "فرد",
    role: "other_adult",
    member_type: "adult",
    sex: "male",
    birth_year: 1988,
    height_cm: 176,
    weight_kg: 84,
    activity_level: "moderate",
    primary_goal: "fat_loss",
    preferred_language: "ar",
    display_order: memberSeq,
    meal_mode: "shared",
    dietary_restrictions: [],
    medical_conditions: [],
    allergies: [],
    dislikes: [],
    trimester: null,
    months_postpartum: null,
    high_risk_pregnancy: false,
    school_meal_handling: null,
    picky_eater: false,
    consulted_doctor: false,
    target_weight_kg: null,
    day_nature: null,
    exercise_days: null,
    exercise_type: null,
    water_cups: null,
    water_liters: null,
    sleep_hours: null,
    medications: [],
    supplements: [],
    nausea_foods: [],
    feeding_mode: null,
    workout_profile: null,
    ...over,
  };
}
