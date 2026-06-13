import type { MemberType } from "@/app/onboarding/actions";

// Shared option/label sets for the member edit hub + sub-forms. The adult
// activity + goal sets are reused from the mom profile so the screens read
// identically; the rest are member-specific (child / pregnant / lactating).
export {
  ACTIVITY_OPTIONS,
  GOALS,
  labelFor,
  asStringArray,
} from "@/app/profile/labels";

export const CHILD_ACTIVITY: { value: string; label: string }[] = [
  { value: "light", label: "قليل" },
  { value: "moderate", label: "متوسط" },
  { value: "active", label: "عالي" },
];

export const SCHOOL: { value: string; label: string }[] = [
  { value: "home_packed", label: "وجبة من البيت" },
  { value: "school_provided", label: "من المدرسة" },
  { value: "mixed", label: "مزيج" },
];

export const PREGNANT_CONDITIONS: { slug: string; label_ar: string }[] = [
  { slug: "gestational_diabetes", label_ar: "سكري الحمل" },
  { slug: "pregnancy_hypertension", label_ar: "ارتفاع ضغط الحمل" },
  { slug: "anemia", label_ar: "الأنيميا" },
];

export const LACTATING_CONDITIONS: { slug: string; label_ar: string }[] = [
  { slug: "stable_hypothyroid", label_ar: "قصور الغدة الدرقية" },
  { slug: "controlled_hypertension", label_ar: "ارتفاع ضغط مسيطر عليه" },
  { slug: "anemia", label_ar: "الأنيميا" },
];

export const TYPE_TITLES: Record<MemberType, string> = {
  adult: "تعديل بيانات فرد بالغ",
  child: "تعديل بيانات طفل",
  pregnant: "تعديل بيانات (حامل)",
  lactating: "تعديل بيانات (مرضعة)",
};
