import type { UserGoal } from "@/lib/plans/goalMapping";

// Option constants reproduced from the onboarding flow so the edit forms are
// visually + behaviorally identical. Shared by the hub (summaries) and forms.

export const ACTIVITY_OPTIONS: Array<{
  value: "sedentary" | "light" | "moderate" | "active" | "very_active";
  label: string;
  sublabel: string;
}> = [
  { value: "sedentary", label: "خامل", sublabel: "جلوس معظم اليوم دون رياضة" },
  { value: "light", label: "نشاط خفيف", sublabel: "رياضة 1-3 أيام في الأسبوع" },
  { value: "moderate", label: "نشاط متوسط", sublabel: "رياضة 3-5 أيام في الأسبوع" },
  { value: "active", label: "نشاط عالي", sublabel: "رياضة 6-7 أيام في الأسبوع" },
  { value: "very_active", label: "نشاط عالي جداً", sublabel: "تدريب مكثف أو عمل بدني" },
];

export const GOALS: { value: UserGoal; label: string }[] = [
  { value: "lose_weight", label: "خسارة الدهون" },
  { value: "build_muscle", label: "بناء كتلة عضلية" },
  { value: "recomposition", label: "إعادة تشكيل الجسم (عضل أكثر ودهون أقل)" },
  { value: "maintain_weight", label: "المحافظة على الوزن" },
  { value: "athletic", label: "تحسين الأداء الرياضي" },
  { value: "improve_health", label: "تحسين الحالة الصحية" },
];

export const CUISINES: { value: string; label: string }[] = [
  { value: "khaleeji", label: "خليجي" },
  { value: "arabic", label: "عربي" },
  { value: "asian", label: "آسيوي" },
  { value: "western", label: "غربي" },
  { value: "varied", label: "متنوع" },
];

export const DIETARY: { value: string; label: string }[] = [
  { value: "vegetarian", label: "نباتي" },
  { value: "vegan", label: "فيغان" },
  { value: "gluten_free", label: "خالي من الجلوتين" },
  { value: "lactose_free", label: "خالي من اللاكتوز" },
  { value: "nut_free", label: "خالي من المكسرات" },
  { value: "egg_free", label: "خالي من البيض" },
];

export const COOKING: { value: string; label: string }[] = [
  { value: "grilling", label: "شوي" },
  { value: "boiling", label: "سلق" },
  { value: "steaming", label: "طبخ بالبخار" },
  { value: "baking", label: "فرن" },
  { value: "air_fryer", label: "مقلاة هوائية" },
  { value: "frying_minimal", label: "قلي بزيت قليل" },
];

// Stored values that predate the 07/2026 option lists (00016 remaps cuisines
// in the DB; until it's applied — and forever for deep_frying — summaries
// still need a label).
const LEGACY_LABELS: Record<string, string> = {
  mediterranean: "متوسطي",
  mixed: "متنوع",
  international: "غربي",
  deep_frying: "قلي عميق",
};

export const MEAL_OUT: { value: string; label: string }[] = [
  { value: "never", label: "أبداً" },
  { value: "rarely", label: "نادراً (1-2)" },
  { value: "sometimes", label: "أحياناً (3-4)" },
  { value: "often", label: "غالباً (5+)" },
];

export function labelFor(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? LEGACY_LABELS[value] ?? null;
}

// The jsonb columns (allergies/dislikes/cooking_methods/family_*) come back as
// `Json | null`; coerce defensively to a clean string[] for forms + summaries.
export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
