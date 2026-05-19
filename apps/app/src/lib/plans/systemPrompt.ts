import "server-only";

import type { PlanPromptContext, PlanPromptContextMember } from "./buildPromptContext";

const ROLE_LABELS_AR: Record<string, string> = {
  dad: "الزوج",
  son: "ابن",
  daughter: "ابنة",
  housekeeper: "الخادمة",
  other_adult: "فرد بالغ",
  other_child: "طفل آخر",
};

const ACTIVITY_LABELS_AR: Record<string, string> = {
  sedentary: "قليلة الحركة",
  light: "نشاط خفيف",
  moderate: "نشاط متوسط",
  active: "نشطة",
  very_active: "نشطة جداً",
};

const GOAL_LABELS_AR: Record<string, string> = {
  lose_weight: "نزول الوزن",
  maintain: "ثبات الوزن",
  gain_weight: "زيادة الوزن",
  general_health: "الصحة العامة",
  pregnancy: "الحمل",
  post_pregnancy: "ما بعد الولادة",
  child_growth: "النمو الصحي",
};

const CUISINE_LABELS_AR: Record<string, string> = {
  khaleeji: "خليجي تقليدي",
  mixed: "خليط من الخليجي والعالمي",
  mediterranean: "متوسطي",
};

function labeled(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "غير محدد";
  return map[key] ?? key;
}

function describeMom(c: PlanPromptContext): string {
  const m = c.mom;
  const parts: string[] = [];
  parts.push(`العميلة: ${m.display_name ?? "غير معروف"}`);
  if (m.age != null) parts.push(`${m.age} سنة`);
  if (m.height_cm != null) parts.push(`طولها ${m.height_cm} سم`);
  if (m.weight_kg != null) parts.push(`وزنها ${m.weight_kg} كيلو`);
  parts.push(`نشاطها ${labeled(ACTIVITY_LABELS_AR, m.activity_level)}`);
  parts.push(`هدفها ${labeled(GOAL_LABELS_AR, m.primary_goal)}`);

  let line = parts.join("، ") + ".";

  if (m.medical_conditions.length > 0) {
    line += ` تعاني من: ${m.medical_conditions.join("، ")}.`;
  } else {
    line += " لا تعاني من حالات صحية.";
  }
  if (m.is_pregnant) {
    line += ` حامل (الثلث ${m.pregnancy_trimester ?? "غير محدد"}).`;
  }
  if (m.dietary_restrictions.length > 0) {
    line += ` قيود غذائية: ${m.dietary_restrictions.join("، ")}.`;
  }
  line += ` تفضل مطبخ ${labeled(CUISINE_LABELS_AR, m.cuisine_preference)}.`;

  return line;
}

function describeMember(member: PlanPromptContextMember, idx: number): string {
  const roleLabel = labeled(ROLE_LABELS_AR, member.role);
  const parts: string[] = [];
  parts.push(`${roleLabel}: ${member.name}`);
  if (member.age != null) parts.push(`${member.age} سنة`);
  if (member.height_cm != null) parts.push(`طوله ${member.height_cm} سم`);
  if (member.weight_kg != null) parts.push(`وزنه ${member.weight_kg} كيلو`);
  if (member.activity_level)
    parts.push(`نشاطه ${labeled(ACTIVITY_LABELS_AR, member.activity_level)}`);
  if (member.primary_goal)
    parts.push(`هدفه ${labeled(GOAL_LABELS_AR, member.primary_goal)}`);

  let line = parts.join("، ") + ".";
  if (member.dietary_restrictions.length > 0) {
    line += ` قيود: ${member.dietary_restrictions.join("، ")}.`;
  }
  if (member.role === "housekeeper") {
    line += ` (لغتها: ${member.preferred_language}). الخادمة تنفذ الوصفات للعائلة وليست من المستفيدين.`;
  }
  void idx;
  return line;
}

/**
 * Build the system prompt for Anthropic.
 *
 * Contains two literal tokens that get replaced later:
 *  - {{METHODOLOGY_PLACEHOLDER}}  — Sara's nutrition methodology (Prompt 1.8b)
 *  - {{TONE_PLACEHOLDER}}         — Sara's speaking style guidance (1.8b)
 *
 * The output schema description is human-readable (TS-style) so the model has
 * a concrete reference, with placeholder numeric values to avoid anchoring.
 */
export function buildSystemPrompt(context: PlanPromptContext): string {
  const momLine = describeMom(context);
  const memberLines = context.family_members
    .map((m, i) => `- ${describeMember(m, i)}`)
    .join("\n");

  const familyBlock =
    memberLines.length > 0 ? `\nأفراد العائلة:\n${memberLines}` : "";

  return `# دورك

أنتِ سارة، أخصائية تغذية خليجية، متخصصة في تصميم خطط غذائية للعائلات السعودية والخليجية. تكتبين بالعربية فقط، وتراعين الذوق الخليجي التقليدي في اختيار الوصفات. {{TONE_PLACEHOLDER}}

# منهجيتك

{{METHODOLOGY_PLACEHOLDER}}

# معطيات العميلة والعائلة

${momLine}${familyBlock}

ملخص العائلة: ${context.composition_summary}

# المطلوب

أنشئي خطة غذائية أسبوعية كاملة (7 أيام، من السبت إلى الجمعة) لكل فرد من أفراد العائلة المستفيدين (الأم والأب والأطفال). الخادمة لا تأخذ خطة خاصة بها، لكن الوصفات يجب أن تكون مكتوبة بوضوح وقابلة للتنفيذ من قبلها.

# قواعد صارمة

- استخدمي صيغة المؤنث (أنتِ) عند مخاطبة الأم.
- لا تستخدمي علامات التعجب.
- جميع أسماء الوصفات والمكونات والخطوات بالعربية.
- خطوات التحضير (prep_steps_ar) يجب أن تكون مختصرة وعملية، موجهة لشخص ينفذ الوصفة (الخادمة).
- المقادير بالجرامات (g) أو الوحدات المنزلية المألوفة (cup، tbsp، piece، ml).

# تنسيق الإخراج

أرجعي JSON صالحاً فقط. لا مقدمة، لا تعليقات، لا أكواد محاطة بـ \`\`\`json. الشكل المطلوب (الأرقام في المثال أدناه وهمية للتوضيح فقط):

\`\`\`ts
type MealPlan = {
  week_start_date: string;       // ISO date, e.g. "2026-05-23"
  members: Array<{
    member_id: string;           // "mom" أو معرف فرد العائلة (uuid)
    member_name_ar: string;
    daily_calories_target: number;   // مثال: 000
    macros_target: { protein_g: number; carbs_g: number; fat_g: number };
    days: Array<{                // طول المصفوفة بالضبط 7
      day_index: number;         // 0..6
      day_name_ar: string;       // "السبت" .. "الجمعة"
      meals: Array<{
        slot: "breakfast" | "lunch" | "dinner" | "snack";
        slot_name_ar: string;    // "الفطور" / "الغداء" / "العشاء" / "السناك"
        recipe_name_ar: string;
        ingredients: Array<{
          name_ar: string;
          amount: number;
          unit: "g" | "ml" | "cup" | "tbsp" | "piece";
        }>;
        prep_steps_ar: string[]; // خطوات مختصرة وعملية للخادمة
        calories: number;        // مثال: 000
        macros: { protein_g: number; carbs_g: number; fat_g: number };
      }>;
      day_total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    }>;
  }>;
};
\`\`\`

مثال على وجبة واحدة (للتوضيح فقط، استبدلي القيم بمحتوى حقيقي):

\`\`\`json
{
  "slot": "breakfast",
  "slot_name_ar": "الفطور",
  "recipe_name_ar": "بيض مسلوق مع خبز شراك",
  "ingredients": [
    { "name_ar": "بيض", "amount": 0, "unit": "piece" },
    { "name_ar": "خبز شراك", "amount": 0, "unit": "piece" }
  ],
  "prep_steps_ar": [
    "اسلقي البيض في ماء مغلي 8 دقائق.",
    "قدميه مع خبز الشراك"
  ],
  "calories": 000,
  "macros": { "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
}
\`\`\`

أرجعي JSON كامل وصالح يطابق الشكل أعلاه، بدون أي نص قبل أو بعده.`;
}
