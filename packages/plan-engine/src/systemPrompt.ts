import {
  getBeneficiaries,
  type PlanPromptContext,
  type PlanPromptContextMember,
} from "./buildContext";
import type { PlanSkeleton } from "./schema";

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
  // Sara's 8
  fat_loss: "نزول الوزن",
  muscle_gain: "زيادة العضل",
  body_recomposition: "إعادة تركيب الجسم",
  athletic_performance: "الأداء الرياضي",
  metabolic_health: "الصحة الأيضية",
  digestive_health: "صحة الجهاز الهضمي",
  pregnancy_lactation: "الحمل والرضاعة",
  posture_recovery: "القوام والتعافي",
  // legacy
  lose_weight: "نزول الوزن",
  maintain: "ثبات الوزن",
  gain_weight: "زيادة الوزن",
  general_health: "الصحة العامة",
  pregnancy: "الحمل",
  post_pregnancy: "ما بعد الولادة",
  child_growth: "النمو الصحي",
};

const MEAL_OUT_LABELS_AR: Record<string, string> = {
  never: "أبداً",
  rarely: "نادراً (1-2 في الأسبوع)",
  sometimes: "أحياناً (3-4 في الأسبوع)",
  often: "غالباً (5+ في الأسبوع)",
};

const CUISINE_LABELS_AR: Record<string, string> = {
  khaleeji: "خليجي تقليدي",
  mixed: "خليط من الخليجي والعالمي",
  mediterranean: "متوسطي",
  international: "عالمي",
};

function labeled(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "غير محدد";
  return map[key] ?? key;
}

function describeMom(c: PlanPromptContext): string {
  const m = c.mom;
  const parts: string[] = [];
  parts.push(`العميلة (الأم): ${m.display_name ?? "غير معروف"}`);
  if (m.age != null) parts.push(`${m.age} سنة`);
  if (m.height_cm != null) parts.push(`طولها ${m.height_cm} سم`);
  if (m.weight_kg != null) parts.push(`وزنها ${m.weight_kg} كيلو`);
  parts.push(`نشاطها ${labeled(ACTIVITY_LABELS_AR, m.activity_level)}`);
  parts.push(`هدفها ${labeled(GOAL_LABELS_AR, m.primary_goal)}`);

  let line = parts.join("، ") + ".";

  if (m.medical_conditions.length > 0) {
    line += ` تعاني من: ${m.medical_conditions.join("، ")} — طبّقي قواعد الحالة الصحية المناسبة.`;
  } else {
    line += " لا تعاني من حالات صحية.";
  }
  if (m.is_pregnant) {
    line += ` حامل (الثلث ${m.pregnancy_trimester ?? "غير محدد"})${m.high_risk_pregnancy ? " — حمل عالي الخطورة" : ""} — طبّقي قواعد الحمل.`;
  }
  if (m.months_postpartum != null) {
    line += ` مرضعة (مرّ ${m.months_postpartum} شهر على الولادة) — طبّقي قواعد الرضاعة.`;
  }
  if (m.dietary_restrictions.length > 0) {
    line += ` قيود غذائية: ${m.dietary_restrictions.join("، ")}.`;
  }
  if (m.allergies.length > 0) {
    line += ` حساسية: ${m.allergies.join("، ")} — تجنّبيها تماماً.`;
  }
  if (m.dislikes.length > 0) {
    line += ` لا تحب: ${m.dislikes.join("، ")}.`;
  }
  line += ` تفضل مطبخ ${labeled(CUISINE_LABELS_AR, m.cuisine_preference)}.`;

  return line;
}

function describeMember(member: PlanPromptContextMember): string {
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
  if (member.allergies.length > 0) {
    line += ` حساسية: ${member.allergies.join("، ")} — تجنّبيها تماماً.`;
  }
  if (member.dislikes.length > 0) {
    line += ` لا يحب: ${member.dislikes.join("، ")}.`;
  }
  if (member.medical_conditions.length > 0) {
    line += ` حالات صحية: ${member.medical_conditions.join("، ")}.`;
  }
  if (member.member_type === "pregnant") {
    line += ` حامل (الثلث ${member.trimester ?? "غير محدد"})${member.high_risk_pregnancy ? " — عالي الخطورة" : ""} — طبّقي قواعد الحمل.`;
  }
  if (member.member_type === "lactating") {
    line += ` مرضعة (مرّ ${member.months_postpartum ?? "غير محدد"} شهر على الولادة) — طبّقي قواعد الرضاعة.`;
  }
  // Children: portion-based planning only — never BMR/TDEE.
  if (member.is_child) {
    if (member.school_meal_handling) {
      line += ` وجبات المدرسة: ${SCHOOL_MEAL_LABELS_AR[member.school_meal_handling] ?? member.school_meal_handling}.`;
    }
    if (member.picky_eater) line += " صعب في الأكل — اختاري أطباق مألوفة ومحبّبة.";
    line +=
      " (طفل — استخدمي حصص الهرم الغذائي الصحي للأطفال، بدون معادلات BMR/TDEE ولا حد سعرات.)";
  }
  return line;
}

const SCHOOL_MEAL_LABELS_AR: Record<string, string> = {
  home_packed: "وجبة من البيت",
  school_provided: "من المدرسة",
  mixed: "مزيج",
};

// Sara's methodology — encoded verbatim (numbers are her professional standard).
// TONE is intentionally left as a placeholder; Email 2 fills {{TONE_PLACEHOLDER}}.
const SARA_METHODOLOGY = `## معادلة السعرات (Mifflin-St Jeor للبالغين)
- BMR للأنثى = (10 × الوزن كجم) + (6.25 × الطول سم) − (5 × العمر) − 161
- BMR للذكر = (10 × الوزن كجم) + (6.25 × الطول سم) − (5 × العمر) + 5
- TDEE = BMR × معامل النشاط
- معاملات النشاط: قليلة الحركة 1.2، نشاط خفيف (1-3 أيام) 1.375، متوسط (3-5 أيام) 1.55، عالي (6-7 أيام) 1.725، عالي جداً (تدريب مكثف/عمل بدني) 1.9

## تعديل السعرات حسب الهدف
- نزول الوزن: TDEE − 300 إلى 500 سعرة
- زيادة العضل: TDEE + 200 إلى 300 سعرة (أو +10-12% للزيادة النظيفة)
- الثبات: TDEE بدون تغيير
- إعادة التركيب: TDEE تقريباً (بروتين عالي، سعرات قرب الثبات)

## توزيع الماكروز حسب الهدف
- نزول الوزن: 45% بروتين / 40% كارب / 15% دهون
- الثبات: 30% بروتين / 40% كارب / 30% دهون
- زيادة العضل: 30% بروتين / 50% كارب / 20% دهون
- إعادة التركيب: بروتين عالي، عامليها كنزول وزن
- التحويل: بروتين_جم = السعرات × نسبة البروتين ÷ 4، كارب_جم = السعرات × نسبة الكارب ÷ 4، دهون_جم = السعرات × نسبة الدهون ÷ 9

## الحمل والرضاعة
- الحمل الثلث الأول (شهر 1-3): سعرات الثبات مع التركيز على جودة العناصر
- الحمل الثلث الثاني والثالث (شهر 4-9): الثبات + 300 سعرة
- الرضاعة (أول 6 أشهر): الثبات + 200-300 سعرة عند الجوع، مع أطعمة تدعم الحليب والمزاج والنوم وتقليل القلق

## الأطفال تحت 18
لا تستخدمي معادلات BMR/TDEE للأطفال إطلاقاً. استخدمي حصص الهرم الغذائي لوزارة الصحة السعودية، وخطّطي حول الحصص المعيارية المتوازنة وليس على هدف سعرات.

## الأهداف المعتمدة (8)
نزول الوزن، زيادة العضل، إعادة تركيب الجسم، الأداء الرياضي (تحمل/قوة/سرعة/لياقة)، الصحة الأيضية (سكري/مقاومة إنسولين/ضغط/غدة/تكيس مبايض/كبد دهني/دهون الدم)، صحة الجهاز الهضمي (قولون/انتفاخ/إمساك/حساسية طعام/ارتجاع)، الحمل والرضاعة، القوام/تكوين الجسم مع التدريب.

## التعديلات حسب الحالات الصحية
- السكري/مقاومة الإنسولين: ضبط كمية وجودة الكارب (منخفض لمتوسط حسب الحالة)، ألياف وبروتين عالي لثبات السكر، توزيع الكارب على اليوم وعدم تجميعه في وجبة واحدة، تنسيق التوقيت مع الدواء/الإنسولين، متابعة القراءات والأعراض.
- الضغط: ضبط الصوديوم، زيادة البوتاسيوم والمغنيسيوم (إن سمحت الحالة)، تقليل المعلبات والمصنّعات، إدارة الوزن إن لزم، الانتباه لتداخل الأدوية.
- تكيس المبايض: تحسين حساسية الإنسولين، بروتين كافٍ وألياف عالية، تنظيم الكارب حسب استجابة الجسم، دعم النوم وإدارة التوتر والنشاط البدني، نزول وزن تدريجي إن لزم.
- قصور الغدة الدرقية: التأكد من استقرار العلاج والتحاليل قبل التعديل، تجنّب خفض السعرات الحاد، بروتين كافٍ للحفاظ على العضل، مراعاة الطاقة والإمساك واحتباس السوائل والإرهاق، الانتباه لتوقيت الطعام/المكملات مع الدواء.
- قاعدة عامة: أي حالة صحية تتطلب خطة شخصية وليست مجرد حساب سعرات وماكروز، وتتطلب استشارة الطبيب قبل البدء.

## عدد الوجبات وتوزيعها (غير ثابت — حسب الهدف)
- متوازن افتراضي (3 وجبات + سناك): فطور 25% / غداء 35-40% / عشاء 25-30% / سناك 10-15%
- نزول الوزن: فطور 30% / غداء 35% / عشاء 25% / سناك 10%
- زيادة العضل/الأداء الرياضي: 4-5 وجبات بتوزيع البروتين على اليوم، وحمل سعرات أعلى حول التمرين
- السكري/مقاومة الإنسولين: توزيع الكارب أهم من عدد السعرات، وتجنّب جرعة كارب كبيرة في وجبة واحدة
- مشاكل الهضم: وجبات أصغر وأكثر تكراراً (4-6 وجبات صغيرة)

## الأطباق الخليجية المفضلة
كبسة دجاج أو لحم، الجريش، المفلق أو البرغل، المرقوق أو القرصان، المكرونة/الباستا، الكشري (بمقادير محسوبة)، المشاوي بأنواعها، السمك مع الأرز، الفول أو الحمص. وأطباق الفطور: فاصوليا، حمص، البيض، اللبنة، زعتر، الجبن، الخبز المناسب.
المبدأ الأساسي: لا حرمان. الأطعمة المألوفة يُعاد توظيفها بمقادير وطرق تحضير معدّلة لتخدم الهدف الصحي.

## الأطعمة المُقللة أو المُتجنبة (حسب الحالة)
الأطعمة المصنّعة عالية المعالجة منخفضة القيمة، المشروبات السكرية والسكر المضاف المتكرر، الدهون المتحولة والمقالي المعادة، الوجبات السريعة عالية السعرات قليلة الإشباع، عالية الصوديوم (خاصة للضغط/احتباس السوائل)، سريعة رفع السكر (للسكري/مقاومة الإنسولين)، والأطعمة المسببة لأعراض هضمية (حسب الفرد).
قاعدة: لا تمنعي مجموعة غذائية كاملة بدون سبب طبي أو متعلق بالهدف.

## منهجية تخطيط العائلة (أساسية)
ابني وصفة أساس واحدة مشتركة للعائلة كلها، ثم خصّصي المقادير والإضافات لكل فرد حسب هدفه/احتياجه.
مثال: وجبة أساس = دجاج مشوي + أرز + سلطة:
- الأم (نزول وزن): 150 جم دجاج، 100-120 جم أرز، سلطة حرة
- الأب (زيادة عضل): 220-250 جم دجاج، 180-250 جم أرز، + مصدر دهون صحية أو سناك داعم
- مراهق رياضي: مقادير كارب وبروتين أعلى
- فرد مصاب بالسكري: نوع وكمية كارب معدّلة، وصوديوم مضبوط
- الأطفال: حصة مناسبة للعمر والحاجة، بدون قيود غير ضرورية
أعطي خطة منفصلة تماماً (وليست أساس مشترك) فقط في: سكري يتطلب ضبطاً دقيقاً، حساسية/عدم تحمّل طعام، مشاكل هضم شديدة، الحمل أو الرضاعة، أو اختلاف جذري في الأهداف. لبقية الأفراد: وصفة واحدة بمقادير مختلفة.

## الحد الأدنى لكل وصفة
لكل وصفة: اسم واضح، قائمة مكونات كاملة، مقادير دقيقة (جرامات/ملاعق/أكواب وليس تقديرات غامضة)، خطوات تحضير واضحة، وقت التحضير + وقت الطبخ، عدد الحصص، القيم الغذائية للحصة (سعرات/بروتين/كارب/دهون)، وبدائل/تعديلات (خالي جلوتين، قليل صوديوم، مناسب للسكري...). واختيارياً: ملاحظات تخزين/تحضير مسبق/تحذير حساسية.

## الحدود الآمنة
- المرأة البالغة: الحد الأدنى 1600 سعرة/يوم في الظروف الطبيعية.
- أقل من 1400 سعرة/يوم: يتطلب تبريراً صريحاً وإشرافاً مختصاً — لا تنزلي تحته.
- 1500 سعرة: مقبول فقط إذا دعمه حساب TDEE وكانت الماكروز والمغذيات كافية وبدون أعراض.
هذه الحدود للبالغين فقط — الأطفال يُخطَّط لهم بالحصص لا بالسعرات.

## الحالات التي تتطلب طبيباً قبل الخطة
حمل/رضاعة عالي الخطورة يحتاج تدخلاً غذائياً خاصاً، سكري غير مستقر، ضغط غير منضبط، أمراض قلب/كلى/كبد، اضطراب غدة درقية غير مستقر، حساسية طعام شديدة، اضطراب هضمي حاد/غير مشخّص، اضطرابات الأكل، تعافٍ بعد جراحة/حالة طبية خاصة، أو أي أعراض غير مفسّرة تحتاج تشخيصاً. المبدأ: إذا تجاوزت الحالة نطاق التخطيط الغذائي الآمن، الطبيب أولاً ثم تُبنى الخطة حول الحالة.`;

/**
 * Static system prefix — identical across the skeleton call AND every per-day
 * call, so it's sent as a cached block (streamAnthropic's systemStatic).
 * {{TONE_PLACEHOLDER}} is filled later (Email 2).
 */
export const STATIC_SYSTEM = `# دورك

أنتِ سارة، أخصائية تغذية خليجية، متخصصة في تصميم خطط غذائية للعائلات السعودية والخليجية. تكتبين بالعربية فقط، وتراعين الذوق الخليجي التقليدي في اختيار الوصفات. {{TONE_PLACEHOLDER}}

# منهجيتك

${SARA_METHODOLOGY}`;

const DAY_NAMES_AR = [
  "السبت",
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

function buildRoster(
  context: PlanPromptContext,
  targetMemberIds?: string[],
): string {
  let beneficiaries = getBeneficiaries(context);
  if (targetMemberIds) {
    const set = new Set(targetMemberIds);
    beneficiaries = beneficiaries.filter((b) => set.has(b.member_id));
  }
  return beneficiaries
    .map((b) => {
      const desc =
        b.member_id === "mom"
          ? describeMom(context)
          : describeMember(
              context.family_members.find((m) => m.id === b.member_id) ?? {
                id: b.member_id,
                name: b.member_name_ar,
                role: b.role,
                member_type: "adult",
                sex: null,
                age: null,
                height_cm: null,
                weight_kg: null,
                activity_level: null,
                primary_goal: null,
                dietary_restrictions: [],
                medical_conditions: [],
                allergies: [],
                dislikes: [],
                trimester: null,
                months_postpartum: null,
                high_risk_pregnancy: false,
                school_meal_handling: null,
                picky_eater: false,
                consulted_doctor: false,
                is_child: false,
                preferred_language: "ar",
              },
            );
      return `- member_id="${b.member_id}" — ${desc}`;
    })
    .join("\n");
}

function familyWideText(context: PlanPromptContext): string {
  const fw = context.family_wide;
  const bits: string[] = [];
  if (fw.dietary_restrictions.length > 0)
    bits.push(`قيود غذائية للعائلة: ${fw.dietary_restrictions.join("، ")}`);
  if (fw.dislikes.length > 0)
    bits.push(`أطعمة لا تأكلها العائلة أبداً: ${fw.dislikes.join("، ")}`);
  if (fw.cooking_methods.length > 0)
    bits.push(`طرق الطبخ المفضلة: ${fw.cooking_methods.join("، ")}`);
  if (fw.meal_out_frequency)
    bits.push(
      `الأكل خارج البيت: ${MEAL_OUT_LABELS_AR[fw.meal_out_frequency] ?? fw.meal_out_frequency}`,
    );
  return bits.length > 0
    ? `\n\nتفضيلات العائلة المشتركة (طبّقيها على الجميع): ${bits.join("؛ ")}.`
    : "";
}

/**
 * Phase 1 — the dynamic part of the SKELETON call: compute per-member targets +
 * a week of dish NAMES only (no recipes). Small + fast; decides variety and
 * which meals are shared across the family (same recipe_name_ar = shared).
 */
export function buildSkeletonPrompt(
  context: PlanPromptContext,
  targetMemberIds?: string[],
): string {
  const count = targetMemberIds
    ? targetMemberIds.length
    : getBeneficiaries(context).length;
  const isSolo = count === 1;
  const sharedNote = isSolo
    ? "هذه خطة لفرد واحد، لا تشارك."
    : "عندما تكون الوجبة نفسها مشتركة بين أكثر من فرد، استخدمي **نفس** recipe_name_ar لهم حتى نوسّعها لاحقاً كوصفة عائلة واحدة بحصص مختلفة.";

  return `# سياق العائلة

ملخص العائلة: ${context.composition_summary}${familyWideText(context)}

الخدامة (إن وجدت) تطبخ وتنفّذ الوصفات، وليست فرداً في الخطة.

# أفراد الخطة المطلوبة الآن (استخدمي member_id بالضبط)
${buildRoster(context, targetMemberIds)}

# المطلوب (المرحلة 1: الهيكل فقط)
احسبي لكل بالغ هدفه اليومي (سعرات + ماكروز) حسب منهجيتك (Mifflin-St Jeor + النشاط + الهدف + توزيع الماكروز). الأطفال: ضعي daily_calories_target تقديرياً (الخطة لهم بالحصص).
ثم خطّطي **أسبوعاً كاملاً (7 أيام، السبت→الجمعة)** من **أسماء الأطباق الخليجية فقط** لكل فرد — متنوّعة عبر الأيام، بدون مكونات أو خطوات. ${sharedNote}

# الإخراج
أرجعي JSON صالحاً فقط (لا نص قبله/بعده، لا أكواد محاطة). الشكل:
\`\`\`ts
type Skeleton = {
  safety_disclaimer_ar: string;            // تذكير مختصر بأن الخطة لا تغني عن الطبيب
  methodology_notes_ar?: string;
  members: Array<{
    member_id: string;                     // كما هو أعلاه
    primary_goal?: "fat_loss"|"muscle_gain"|"body_recomposition"|"athletic_performance"|"metabolic_health"|"digestive_health"|"pregnancy_lactation"|"posture_recovery";
    daily_calories_target: number;
    macros_target: { protein_g: number; carbs_g: number; fat_g: number };
    days: Array<{                          // 7 عناصر
      day_index: number;                   // 0..6 (0=السبت)
      day_name_ar: string;
      meals: Array<{ slot: "breakfast"|"lunch"|"dinner"|"snack"; slot_name_ar: string; recipe_name_ar: string }>;
    }>;
  }>;
};
\`\`\``;
}

/**
 * Phase 2 — the dynamic part of one DAY's expansion call: turn that day's named
 * meals into full recipes hitting each member's targets. Runs in parallel.
 */
export function buildDayPrompt(
  context: PlanPromptContext,
  skeleton: PlanSkeleton,
  dayIndex: number,
): string {
  const dayName = DAY_NAMES_AR[dayIndex] ?? `اليوم ${dayIndex + 1}`;
  const isSolo = skeleton.members.length === 1;

  const memberBlocks = skeleton.members
    .map((sm) => {
      const ctxMember =
        sm.member_id === "mom"
          ? null
          : context.family_members.find((m) => m.id === sm.member_id);
      const isChild =
        sm.member_id === "mom"
          ? context.mom.member_type === "child"
          : (ctxMember?.is_child ?? false);

      const constraints: string[] = [];
      const allergies =
        sm.member_id === "mom" ? context.mom.allergies : (ctxMember?.allergies ?? []);
      const dislikes =
        sm.member_id === "mom" ? context.mom.dislikes : (ctxMember?.dislikes ?? []);
      const conditions =
        sm.member_id === "mom"
          ? context.mom.medical_conditions
          : (ctxMember?.medical_conditions ?? []);
      if (allergies.length) constraints.push(`حساسية (تجنّب تام): ${allergies.join("، ")}`);
      if (dislikes.length) constraints.push(`لا يحب: ${dislikes.join("، ")}`);
      if (conditions.length) constraints.push(`حالات: ${conditions.join("، ")}`);

      const day = sm.days.find((d) => d.day_index === dayIndex);
      const meals = (day?.meals ?? [])
        .map((m) => `${m.slot_name_ar} (${m.slot}): ${m.recipe_name_ar}`)
        .join(" | ");

      const target = isChild
        ? "طفل — بالحصص، بدون هدف سعرات"
        : `الهدف: ${sm.daily_calories_target} سعرة، بروتين ${sm.macros_target.protein_g} / كارب ${sm.macros_target.carbs_g} / دهون ${sm.macros_target.fat_g} (جم)`;

      return `• member_id="${sm.member_id}" — ${target}${constraints.length ? `؛ ${constraints.join("؛ ")}` : ""}\n  وجبات اليوم: ${meals || "—"}`;
    })
    .join("\n");

  const sharedRule = isSolo
    ? "كل وجبة مخصصة لها فقط (لا مشاركة)."
    : "عند تطابق اسم الطبق بين أفراد: ضعي shared_recipe=true، اكتبي المكونات الأساسية مرة واحدة في ingredients، وفي per_member_portions اذكري **الفروقات فقط** بالمقادير لكل فرد (لا تكرري الوصفة). للأطفال: حصص مناسبة بدون معادلات سعرات.";

  return `# المطلوب (المرحلة 2: توسيع يوم واحد)
وسّعي وجبات **${dayName}** (day_index=${dayIndex}) فقط، لكل فرد، إلى وصفات كاملة تحقق هدف كل فرد. التزمي بأسماء الأطباق المعطاة لكل فرد كما هي.

${sharedRule}

# الأفراد ووجبات هذا اليوم
${memberBlocks}${familyWideText(context)}

# الإيجاز
- prep_steps_ar: 3-4 خطوات قصيرة كحد أقصى.
- الحقول الاختيارية (substitutions_ar، notes_ar، prep_time_minutes، cook_time_minutes، servings_count): اتركيها فارغة إلا عند ضرورة حقيقية.
- قائمة مكونات موجزة. "سلطة حرة" → unit:"unlimited".
- الكتابة بالعربية فقط، صيغة المؤنث، بدون علامات تعجب.

# الإخراج
أرجعي JSON صالحاً فقط لهذا اليوم (لا day_total — نحسبه نحن). الشكل:
\`\`\`ts
type DaySlice = {
  day_index: number;                       // ${dayIndex}
  day_name_ar: string;                     // "${dayName}"
  members: Array<{
    member_id: string;                     // كما هو أعلاه
    meals: Array<{
      slot: "breakfast"|"lunch"|"dinner"|"snack";
      slot_name_ar: string;
      recipe_name_ar: string;
      ingredients: Array<{ name_ar: string; amount: number; amount_min?: number; amount_max?: number; unit: "g"|"kg"|"ml"|"l"|"tbsp"|"tsp"|"cup"|"piece"|"serving"|"unlimited" }>;
      prep_steps_ar: string[];
      shared_recipe?: boolean;
      per_member_portions?: Array<{ member_id: string; ingredients: Array<{ name_ar: string; amount: number; amount_min?: number; amount_max?: number; unit: string }>; notes_ar?: string }>;
      substitutions_ar?: string[];
      notes_ar?: string;
      calories: number;
      macros: { protein_g: number; carbs_g: number; fat_g: number };
    }>;
  }>;
};
\`\`\``;
}
