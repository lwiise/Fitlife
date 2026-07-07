import { z } from "zod";

const currentYear = new Date().getFullYear();

// ─── Step 1: Mom's identity ───────────────────────
export const step1Schema = z.object({
  display_name: z.string().min(2, "يجب أن يكون الاسم حرفين أو أكثر").max(50),
  birth_year: z
    .number()
    .int()
    .min(1940, "يجب أن تكون السنة بعد 1940")
    .max(currentYear - 13, "يجب أن يكون عمرك فوق 13 سنة"),
});

// ─── Step 2: Mom's physical ───────────────────────
export const step2Schema = z.object({
  height_cm: z.number().min(120, "الطول قليل").max(220, "الطول مرتفع"),
  weight_kg: z.number().min(30, "الوزن قليل").max(250, "الوزن مرتفع"),
  // اختياري — مفيد لأهداف تغيير الوزن؛ يُترك فارغاً لأهداف الثبات والصحة.
  target_weight_kg: z
    .union([
      z.number().min(30, "الوزن المستهدف قليل").max(250, "الوزن المستهدف مرتفع"),
      z.nan(),
    ])
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
});
