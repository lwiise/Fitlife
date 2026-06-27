// Option lists (Arabic-labelled, draft copy) + screening thresholds for the opt-in
// exercise wizard. Arabic strings are functional drafts — polish to the warm
// colloquial Gulf style before ship (run arabic-copy-checker).

import type {
  AvailabilityDays,
  DeliveryType,
  Equipment,
  ExerciseFocus,
  ExerciseSetting,
  ExerciseType,
  MskRegion,
  SessionMinutes,
} from "./types";

export const EXERCISE_FOCUS_OPTIONS: { value: ExerciseFocus; label_ar: string }[] = [
  { value: "strength", label_ar: "قوة" },
  { value: "mobility", label_ar: "مرونة" },
  { value: "endurance", label_ar: "تحمّل" },
  { value: "general", label_ar: "لياقة عامة" },
];

export const EXERCISE_TYPE_OPTIONS: { value: ExerciseType; label_ar: string }[] = [
  { value: "walking", label_ar: "مشي" },
  { value: "strength", label_ar: "تمارين قوة" },
  { value: "yoga_pilates", label_ar: "يوغا أو بيلاتس" },
  { value: "cardio", label_ar: "كارديو" },
];

export const SETTING_OPTIONS: { value: ExerciseSetting; label_ar: string }[] = [
  { value: "home", label_ar: "بيت" },
  { value: "gym", label_ar: "نادي" },
  { value: "outdoor", label_ar: "برّا" },
];

export const EQUIPMENT_OPTIONS: { value: Equipment; label_ar: string }[] = [
  { value: "none", label_ar: "بدون أدوات" },
  { value: "weights", label_ar: "أوزان" },
  { value: "bands", label_ar: "أحزمة مطاطية" },
  { value: "treadmill", label_ar: "جهاز مشي" },
];

export const MSK_REGION_OPTIONS: { value: MskRegion; label_ar: string }[] = [
  { value: "back", label_ar: "ظهر" },
  { value: "knee", label_ar: "ركبة" },
  { value: "shoulder", label_ar: "كتف" },
  { value: "neck", label_ar: "رقبة" },
  { value: "hip", label_ar: "ورك" },
  { value: "wrist", label_ar: "معصم" },
  { value: "ankle", label_ar: "كاحل" },
];

export const AVAILABILITY_OPTIONS: { value: AvailabilityDays; label_ar: string }[] = [
  { value: "1-2", label_ar: "1-2" },
  { value: "3-4", label_ar: "3-4" },
  { value: "5+", label_ar: "5+" },
];

export const SESSION_MINUTES_OPTIONS: { value: SessionMinutes; label_ar: string }[] = [
  { value: 15, label_ar: "15" },
  { value: 30, label_ar: "30" },
  { value: 45, label_ar: "45+" },
];

export const DELIVERY_OPTIONS: { value: DeliveryType; label_ar: string }[] = [
  { value: "vaginal", label_ar: "طبيعية" },
  { value: "c_section", label_ar: "قيصرية" },
];

// ACSM Guidelines (11th ed., Table 2.1) pre-participation symptom set. Any selected
// symptom → clearance required + intensity capped. "ولا واحد منهم" clears the list.
export const EXERCISE_SYMPTOM_OPTIONS: { slug: string; label_ar: string }[] = [
  { slug: "chest_pain", label_ar: "ألم أو ضيق بالصدر عند المجهود" },
  { slug: "breathless", label_ar: "ضيق نفس عند الراحة أو مجهود بسيط" },
  { slug: "dizziness", label_ar: "دوخة أو إغماء" },
  { slug: "palpitations", label_ar: "خفقان أو عدم انتظام في نبض القلب" },
  { slug: "ankle_swelling", label_ar: "تورم في الكاحل" },
  { slug: "unusual_fatigue", label_ar: "تعب غير معتاد" },
];

// Conditions (from medicalConditions.ts) that make rate-limiting meds plausible →
// render the hr_meds question, which can flip the member to RPE targets.
export const CARDIO_MED_CONDITION_SLUGS: ReadonlySet<string> = new Set([
  "heart_disease",
  "uncontrolled_hypertension",
  "controlled_hypertension",
]);

// At/above this age OR with any medical flag, run the symptom screen (ACSM 2.1).
export const SYMPTOM_SCREEN_AGE = 45;

// At/above this age, with no resting HR provided, age-predicted HRmax is
// unreliable → prescribe by RPE instead of HR zones.
export const RPE_AGE_THRESHOLD = 55;
