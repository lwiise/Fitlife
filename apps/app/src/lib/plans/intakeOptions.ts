// Coach Sara full-intake option lists (employer spec, 07/2026) — single source
// for the onboarding wizard and the profile edit forms. Enum-like values are
// stored as plain text (house convention, 00013/00016) and Zod-validated
// server-side. Labels are فصحى per the questionnaire tone directive.

export type SleepBand = "lt5" | "h5_6" | "h7_8" | "gt8";
export const SLEEP_BAND_OPTIONS: Array<{ value: SleepBand; label: string }> = [
  { value: "lt5", label: "أقل من 5 ساعات" },
  { value: "h5_6", label: "5-6 ساعات" },
  { value: "h7_8", label: "7-8 ساعات" },
  { value: "gt8", label: "أكثر من 8 ساعات" },
];

export type StressLevel = "low" | "medium" | "high";
export const STRESS_OPTIONS: Array<{ value: StressLevel; label: string }> = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "مرتفع" },
];

// value 5 means "5 أو أكثر" — stored as the lower bound.
export const MEALS_PER_DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 2, label: "وجبتان" },
  { value: 3, label: "3 وجبات" },
  { value: 4, label: "4 وجبات" },
  { value: 5, label: "5 أو أكثر" },
];

// Personal dietary restrictions (spec section ٧). Values align with the
// family-wide list in FamilyWideForm so the engine reads one vocabulary.
export const PERSONAL_RESTRICTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "lactose_free", label: "عدم تحمل اللاكتوز" },
  { value: "gluten_free", label: "حساسية الجلوتين" },
  { value: "nut_free", label: "حساسية المكسرات" },
  { value: "vegetarian", label: "نباتي" },
  { value: "vegan", label: "فيغان" },
];

// Owner lactation feeding mode (family_members carries the same enum since
// 00013; "formula" stays server-accepted for the member wizard's parity).
export type FeedingMode = "exclusive" | "mixed";
export const FEEDING_MODE_OPTIONS: Array<{ value: FeedingMode; label: string }> = [
  { value: "exclusive", label: "رضاعة طبيعية كاملة" },
  { value: "mixed", label: "رضاعة مختلطة" },
];

export const PREGNANCY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** شهر الحمل → الثلث (the engine's methodology speaks in both). */
export function trimesterFromMonth(month: number): 1 | 2 | 3 {
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  return 3;
}
