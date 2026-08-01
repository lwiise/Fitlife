/**
 * Pure formatting for the advisor's household context.
 *
 * Split out of `context.ts` (which is `server-only` and does the Supabase
 * reads) so the rendering rules — the part that was wrong — can be tested
 * directly.
 */

/**
 * Stored enums rendered in Arabic. The advisor used to receive the raw value,
 * so it answered a lactose-intolerant user with «بما إنك مسجّلة lactose_free» —
 * an English token quoted back at her inside otherwise fluent Arabic.
 */
export const GOAL_AR: Record<string, string> = {
  fat_loss: "نزول الوزن",
  lose_weight: "نزول الوزن",
  muscle_gain: "زيادة العضل",
  body_recomposition: "إعادة تركيب الجسم",
  athletic_performance: "الأداء الرياضي",
  metabolic_health: "الصحة الأيضية",
  digestive_health: "صحة الجهاز الهضمي",
  pregnancy_lactation: "الحمل والرضاعة",
  posture_recovery: "القوام والتعافي",
  maintain: "ثبات الوزن",
  gain_weight: "زيادة الوزن",
  general_health: "الصحة العامة",
  child_growth: "النمو الصحي",
};

export const ACTIVITY_AR: Record<string, string> = {
  sedentary: "خامل (كثير الجلوس)",
  light: "نشاط خفيف (1-3 أيام أسبوعياً)",
  moderate: "نشاط متوسط (3-5 أيام أسبوعياً)",
  active: "نشاط عالي (6-7 أيام أسبوعياً)",
  very_active: "نشاط عالي جداً (تدريب مكثف/عمل بدني)",
};

export const RESTRICTION_AR: Record<string, string> = {
  lactose_free: "عدم تحمل اللاكتوز",
  gluten_free: "حساسية الجلوتين",
  nut_free: "حساسية المكسرات",
  vegetarian: "نباتي",
  vegan: "نباتي صرف",
};

export const CUISINE_AR: Record<string, string> = {
  khaleeji: "خليجي تقليدي",
  arabic: "عربي",
  asian: "آسيوي",
  western: "غربي",
  varied: "متنوع",
  mixed: "خليط",
  mediterranean: "متوسطي",
  international: "عالمي",
};

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "غير محدد";
  return map[key] ?? key;
}

export function labelList(
  map: Record<string, string>,
  values: string[] | null | undefined,
): string {
  return values && values.length ? values.map((v) => map[v] ?? v).join("، ") : "لا شيء";
}

/** Whole years, from the stored birth year — the only age the app records. */
export function ageFromBirthYear(
  birthYear: number | null | undefined,
  now = new Date(),
): number | null {
  if (!birthYear) return null;
  const age = now.getUTCFullYear() - birthYear;
  return age > 0 && age < 120 ? age : null;
}

/**
 * The household's own calendar day.
 *
 * Without this the advisor had no date anchor at all: the plan summary lists day
 * NAMES only, so «وش يأكل فيصل اليوم؟» and «وش ياكل بكرة؟» both came back with
 * the same day — and it was the wrong one. Riyadh time, because that is the
 * kitchen the answer is for.
 */
export function todayLine(now = new Date()): string {
  const weekday = new Intl.DateTimeFormat("ar", {
    weekday: "long",
    timeZone: "Asia/Riyadh",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `اليوم: ${weekday} ${date} (بتوقيت الرياض). «اليوم» و«بكرة» و«أمس» تُحسب من هذا التاريخ، ولا تخمّني يوماً غيره.`;
}

/**
 * The physical numbers every calorie question needs.
 *
 * These were absent from the context entirely, so the advisor could not answer
 * «كم سعرة أحتاج؟» for anyone — it asked the user to re-type her age, height,
 * weight and activity level, all four of which she had already given during
 * onboarding and all four of which are shown back to her on /profile.
 *
 * Postgres `numeric` arrives as a STRING over PostgREST, so height/weight are
 * coerced with Number() rather than interpolated raw.
 */
export function measurements(
  p: {
    sex?: string | null;
    birth_year?: number | null;
    height_cm?: number | string | null;
    weight_kg?: number | string | null;
    activity_level?: string | null;
  },
  now = new Date(),
): string[] {
  const out: string[] = [];
  const age = ageFromBirthYear(p.birth_year, now);
  if (p.sex) out.push(`- الجنس: ${p.sex === "male" ? "ذكر" : "أنثى"}`);
  if (age != null) out.push(`- العمر: ${age} سنة`);
  if (p.height_cm != null) out.push(`- الطول: ${Number(p.height_cm)} سم`);
  if (p.weight_kg != null) out.push(`- الوزن الحالي: ${Number(p.weight_kg)} كجم`);
  if (p.activity_level) out.push(`- مستوى النشاط: ${label(ACTIVITY_AR, p.activity_level)}`);
  return out;
}
