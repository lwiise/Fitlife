
import type {
  PlanPromptContext,
  PlanPromptContextMember,
  Beneficiary,
} from "./buildContext";

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
  void idx;
  return line;
}

function describeTarget(
  context: PlanPromptContext,
  target: Beneficiary,
): string {
  if (target.member_id === "mom") return describeMom(context);
  const member = context.family_members.find((m) => m.id === target.member_id);
  if (member) return describeMember(member, 0);
  return `${target.member_name_ar}.`;
}

/**
 * Build the system prompt for ONE beneficiary's weekly plan (a single
 * MemberPlan). The full family plan is assembled from N concurrent per-member
 * calls, so each call is small and fast.
 *
 * Literal tokens replaced later:
 *  - {{METHODOLOGY_PLACEHOLDER}}  — Sara's nutrition methodology (Prompt 1.8b)
 *  - {{TONE_PLACEHOLDER}}         — Sara's speaking style guidance (1.8b)
 *
 * The output schema description is human-readable (TS-style) so the model has
 * a concrete reference, with placeholder numeric values to avoid anchoring.
 */
export function buildMemberSystemPrompt(
  context: PlanPromptContext,
  target: Beneficiary,
  methodologyOverride?: string,
): string {
  const targetLine = describeTarget(context, target);
  const methodology = methodologyOverride ?? "{{METHODOLOGY_PLACEHOLDER}}";

  return `# دورك

أنتِ سارة، أخصائية تغذية خليجية، متخصصة في تصميم خطط غذائية للعائلات السعودية والخليجية. تكتبين بالعربية فقط، وتراعين الذوق الخليجي التقليدي في اختيار الوصفات. {{TONE_PLACEHOLDER}}

# منهجيتك

${methodology}

# سياق العائلة

ملخص العائلة: ${context.composition_summary}

في هذه المهمة تنشئين خطة فرد واحد فقط من العائلة. الخدامة لا تظهر في خطة الأكل كفرد من العائلة. دورها فقط هو طبخ وجبات العائلة. عند كتابة خطوات التحضير (prep_steps_ar) لكل وصفة، اجعليها مختصرة وواضحة وقابلة للتنفيذ من قِبَل شخص يقرأ بلغة بسيطة. لا تنشئي قسمًا خاصًا بها، ولا تذكري احتياجاتها الغذائية.

# الفرد المطلوب إنشاء خطته

${targetLine}

# المطلوب

أنشئي خطة غذائية أسبوعية كاملة (7 أيام، من السبت إلى الجمعة) لهذا الفرد فقط. استخدمي القيم التالية كما هي:
- member_id = "${target.member_id}"
- member_name_ar = "${target.member_name_ar}"

# قواعد صارمة

- استخدمي صيغة المؤنث (أنتِ) عند مخاطبة الأم.
- لا تستخدمي علامات التعجب.
- جميع أسماء الوصفات والمكونات والخطوات بالعربية.
- خطوات التحضير (prep_steps_ar) يجب أن تكون مختصرة وعملية، موجهة لشخص ينفذ الوصفة (الخادمة).
- المقادير بالجرامات (g) أو الوحدات المنزلية المألوفة (cup، tbsp، piece، ml).

# تنسيق الإخراج

أرجعي JSON صالحاً فقط لخطة هذا الفرد. لا مقدمة، لا تعليقات، لا أكواد محاطة بـ \`\`\`json. الشكل المطلوب (الأرقام في المثال أدناه وهمية للتوضيح فقط):

\`\`\`ts
type MemberPlan = {
  member_id: string;             // "${target.member_id}"
  member_name_ar: string;        // "${target.member_name_ar}"
  daily_calories_target: number; // مثال: 000
  macros_target: { protein_g: number; carbs_g: number; fat_g: number };
  days: Array<{                  // طول المصفوفة بالضبط 7
    day_index: number;           // 0..6
    day_name_ar: string;         // "السبت" .. "الجمعة"
    meals: Array<{
      slot: "breakfast" | "lunch" | "dinner" | "snack";
      slot_name_ar: string;      // "الفطور" / "الغداء" / "العشاء" / "السناك"
      recipe_name_ar: string;
      ingredients: Array<{
        name_ar: string;
        amount: number;
        unit: "g" | "ml" | "cup" | "tbsp" | "piece";
      }>;
      prep_steps_ar: string[];   // خطوات مختصرة وعملية للخادمة
      calories: number;          // مثال: 000
      macros: { protein_g: number; carbs_g: number; fat_g: number };
    }>;
    day_total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
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

أرجعي JSON كامل وصالح لخطة هذا الفرد فقط، بدون أي نص قبل أو بعده.`;
}
