import { z } from "zod";

const currentYear = new Date().getFullYear();

// ─── Step 1: Mom's identity ───────────────────────
export const step1Schema = z.object({
  display_name: z.string().min(2, "الاسم لازم يكون حرفين أو أكثر").max(50),
  birth_year: z
    .number()
    .int()
    .min(1940, "السنة لازم تكون بعد 1940")
    .max(currentYear - 13, "لازم تكوني فوق 13 سنة"),
});

// ─── Step 2: Mom's physical ───────────────────────
export const step2Schema = z.object({
  height_cm: z.number().min(120, "الطول قليل").max(220, "الطول مرتفع"),
  weight_kg: z.number().min(30, "الوزن قليل").max(250, "الوزن مرتفع"),
  activity_level: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ]),
});

// ─── Step 3: Mom's goal ───────────────────────────
export const step3Schema = z.object({
  primary_goal: z.enum([
    "lose_weight",
    "maintain",
    "gain_weight",
    "general_health",
    "pregnancy",
    "post_pregnancy",
  ]),
});

// ─── Step 4: Family composition ───────────────────
export const step4Schema = z.object({
  has_partner: z.boolean(),
  num_children: z.number().int().min(0).max(8),
  has_housekeeper: z.boolean(),
});

// ─── Step 5: Each family member ───────────────────
// The housekeeper is a cook, not a plan beneficiary — she needs only a language
// (and optionally a name). Name + birth_year are required for everyone else.
const memberSchema = z
  .object({
    name: z.string(),
    role: z.enum(["dad", "son", "daughter", "housekeeper"]),
    birth_year: z.number().int().min(1940).max(currentYear).optional(),
    preferred_language: z.enum(["ar", "en", "tl", "id", "bn", "am", "ur"]),
  })
  .superRefine((m, ctx) => {
    if (m.role === "housekeeper") return;
    if (m.name.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "الاسم لازم يكون حرفين أو أكثر",
      });
    }
    if (m.birth_year == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birth_year"],
        message: "اكتبي سنة الميلاد",
      });
    }
  });

export const step5Schema = z.object({
  members: z.array(memberSchema).min(0).max(8),
});

// ─── Step 6: Dietary restrictions ─────────────────
export const dietaryRestrictionOptions = [
  "gluten_free",
  "lactose_intolerant",
  "vegetarian",
  "vegan",
  "nut_allergy",
  "shellfish_allergy",
  "egg_allergy",
] as const;

export const step6Schema = z.object({
  family_dietary_restrictions: z.array(z.enum(dietaryRestrictionOptions)).default([]),
});

// ─── Step 7: Cuisine preference ───────────────────
export const step7Schema = z.object({
  cuisine_preference: z.enum(["khaleeji", "mixed", "mediterranean"]),
});

// ─── Step 8: Medical + safety ─────────────────────
export const medicalConditionOptions = [
  "diabetes_t1",
  "diabetes_t2",
  "hypertension",
  "hypothyroid",
  "high_cholesterol",
  "kidney_disease",
  "heart_disease",
] as const;

export const step8Schema = z
  .object({
    has_medical_conditions: z.boolean(),
    medical_conditions: z.array(z.enum(medicalConditionOptions)).default([]),
    is_pregnant: z.boolean().default(false),
    pregnancy_trimester: z.number().int().min(1).max(3).optional(),
    consulted_doctor: z.boolean().default(false),
  })
  .refine(
    (data) => !(data.has_medical_conditions && data.medical_conditions.length === 0),
    {
      message: "اختاري على الأقل حالة طبية وحدة",
      path: ["medical_conditions"],
    },
  )
  .refine((data) => !(data.is_pregnant && !data.pregnancy_trimester), {
    message: "اختاري الأسبوع من الحمل",
    path: ["pregnancy_trimester"],
  })
  .refine(
    (data) =>
      !((data.has_medical_conditions || data.is_pregnant) && !data.consulted_doctor),
    {
      message: "لازم تأكدي على استشارة الطبيب أولاً",
      path: ["consulted_doctor"],
    },
  );

// ─── Combined wizard state ────────────────────────
export type OnboardingState = {
  step1?: z.infer<typeof step1Schema>;
  step2?: z.infer<typeof step2Schema>;
  step3?: z.infer<typeof step3Schema>;
  step4?: z.infer<typeof step4Schema>;
  step5?: z.infer<typeof step5Schema>;
  step6?: z.infer<typeof step6Schema>;
  step7?: z.infer<typeof step7Schema>;
  step8?: z.infer<typeof step8Schema>;
};
