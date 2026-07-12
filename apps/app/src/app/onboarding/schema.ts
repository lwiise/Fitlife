import { z } from "zod";

const currentYear = new Date().getFullYear();

// ─── Step 1: Owner's identity ─────────────────────
// الجنس comes first (Coach Sara intake, 07/2026): the rest of the wizard's
// copy and steps react to it — feminine remains the default voice.
export const step1Schema = z.object({
  sex: z.enum(["female", "male"], {
    // Neutral wording — shown before the answer, when the sex is unknown.
    errorMap: () => ({ message: "يلزم تحديد الجنس" }),
  }),
  display_name: z.string().min(2, "يجب أن يكون الاسم حرفين أو أكثر").max(50),
  birth_year: z
    .number()
    .int()
    .min(1940, "يجب أن تكون السنة بعد 1940")
    .max(currentYear - 13, "يجب أن يكون عمرك فوق 13 سنة"),
  // اختياري — رقم للتواصل فقط، لا يؤثر على الخطة.
  phone: z
    .string()
    .trim()
    .max(20, "الرقم طويل")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

// ─── Step 2: Owner's physical ─────────────────────
export const step2Schema = z.object({
  height_cm: z.number().min(120, "الطول قليل").max(220, "الطول مرتفع"),
  weight_kg: z.number().min(30, "الوزن قليل").max(250, "الوزن مرتفع"),
  // محيط الخصر والورك اختياريان — ليست كل مستخدمة تملك شريط قياس عند التسجيل.
  waist_cm: z
    .union([z.number().min(30, "المحيط قليل").max(250, "المحيط مرتفع"), z.nan()])
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
  hip_cm: z
    .union([z.number().min(30, "المحيط قليل").max(300, "المحيط مرتفع"), z.nan()])
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
  // اختياري — مفيد لأهداف تغيير الوزن؛ يُترك فارغاً لأهداف الثبات والصحة.
  target_weight_kg: z
    .union([
      z.number().min(30, "الوزن المستهدف قليل").max(250, "الوزن المستهدف مرتفع"),
      z.nan(),
    ])
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
});
