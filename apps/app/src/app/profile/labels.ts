import type { UserGoal } from "@/lib/plans/goalMapping";

// Option constants reproduced from the onboarding flow so the edit forms are
// visually + behaviorally identical. Shared by the hub (summaries) and forms.

export const ACTIVITY_OPTIONS: Array<{
  value: "sedentary" | "light" | "moderate" | "active" | "very_active";
  label: string;
  sublabel: string;
}> = [
  { value: "sedentary", label: "قليلة الحركة", sublabel: "مكتبية، ما أتمرن" },
  { value: "light", label: "خفيفة", sublabel: "مشي خفيف 1-2 مرات في الأسبوع" },
  { value: "moderate", label: "متوسطة", sublabel: "تمارين 3-4 مرات في الأسبوع" },
  { value: "active", label: "نشطة", sublabel: "تمارين 5 مرات أو أكثر" },
  { value: "very_active", label: "نشطة جداً", sublabel: "رياضية محترفة" },
];

export const GOALS: { value: UserGoal; label: string }[] = [
  { value: "lose_weight", label: "نزول الوزن" },
  { value: "maintain_health", label: "الحفاظ على الوزن وتحسين الصحة" },
  { value: "build_muscle", label: "بناء عضل وزيادة قوة" },
  { value: "athletic", label: "تحسين الأداء الرياضي" },
  { value: "manage_condition", label: "إدارة حالة صحية" },
];

export const CUISINES: { value: string; label: string }[] = [
  { value: "khaleeji", label: "خليجي" },
  { value: "mediterranean", label: "متوسطي" },
  { value: "mixed", label: "مختلط" },
  { value: "international", label: "عالمي" },
];

export const DIETARY: { value: string; label: string }[] = [
  { value: "vegetarian", label: "نباتي" },
  { value: "gluten_free", label: "خالي من الجلوتين" },
  { value: "lactose_free", label: "خالي من اللاكتوز" },
  { value: "nut_free", label: "خالي من المكسرات" },
  { value: "egg_free", label: "خالي من البيض" },
];

export const COOKING: { value: string; label: string }[] = [
  { value: "grilling", label: "شوي" },
  { value: "baking", label: "خبيز" },
  { value: "steaming", label: "طبخ بالبخار" },
  { value: "frying_minimal", label: "طبخ بزيت قليل" },
  { value: "deep_frying", label: "قلي عميق (سنقلّله في الخطط)" },
];

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
  return options.find((o) => o.value === value)?.label ?? null;
}

// The jsonb columns (allergies/dislikes/cooking_methods/family_*) come back as
// `Json | null`; coerce defensively to a clean string[] for forms + summaries.
export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
