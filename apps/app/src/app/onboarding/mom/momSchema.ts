import { z } from "zod";

// Mom's goal — 4 friendly options + a medical-management 5th. The actual Sara
// goal is derived at save time via mapUserGoalToSara using medical + pregnancy
// signals collected in later steps.
export const momGoalSchema = z.object({
  user_goal: z.enum([
    "lose_weight",
    "build_muscle",
    "recomposition",
    "maintain_weight",
    "athletic",
    "improve_health",
  ]),
});

// Pregnancy / lactation branch.
export const momPregnancySchema = z
  .object({
    status: z.enum(["none", "pregnant", "lactating"]),
    trimester: z.number().int().min(1).max(3).optional(),
    high_risk_pregnancy: z.boolean().default(false),
    months_postpartum: z.number().int().min(0).max(24).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.status === "pregnant" && d.trimester == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trimester"],
        message: "اختاري الثلث الحالي من الحمل",
      });
    }
    if (d.status === "lactating" && d.months_postpartum == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["months_postpartum"],
        message: "اكتبي كم شهر مرّ على الولادة",
      });
    }
  });

// Free-text chip lists (allergies / personal dislikes).
export const momAllergiesSchema = z.object({
  allergies: z.array(z.string().min(1)).max(20).default([]),
});

export const momDislikesSchema = z.object({
  dislikes: z.array(z.string().min(1)).max(20).default([]),
});

// Medical conditions: any slug from the gate/stable lists + free-text other.
export const momMedicalSchema = z.object({
  conditions: z.array(z.string()).default([]),
  other_condition: z.string().max(200).optional(),
});

export const momDoctorSchema = z.object({
  consulted_doctor: z.boolean().default(false),
});

export type MomGoal = z.infer<typeof momGoalSchema>;
export type MomPregnancy = z.infer<typeof momPregnancySchema>;
export type MomAllergies = z.infer<typeof momAllergiesSchema>;
export type MomDislikes = z.infer<typeof momDislikesSchema>;
export type MomMedical = z.infer<typeof momMedicalSchema>;
export type MomDoctor = z.infer<typeof momDoctorSchema>;
