import {
  getBeneficiaries,
  type PlanPromptContext,
  type PlanPromptContextMember,
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
 * Build the system prompt for the WHOLE family's weekly plan in a single call,
 * following Sara's family-as-unit methodology (shared base recipes + per-member
 * portions). {{TONE_PLACEHOLDER}} is filled later (Email 2).
 */
export function buildSystemPrompt(context: PlanPromptContext): string {
  const beneficiaries = getBeneficiaries(context);
  const roster = beneficiaries
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

  const isSolo = beneficiaries.length === 1;
  const familyDirective = isSolo
    ? "أنشئي خطة غذائية أسبوعية كاملة (7 أيام، من السبت إلى الجمعة) للعميلة فقط. لا يوجد أفراد آخرين في الخطة. لا تطبقي منهجية «نفس الوصفة بحصص مختلفة» — كل وجبة مخصصة لها فقط."
    : "أنشئي خطة غذائية أسبوعية كاملة (7 أيام، من السبت إلى الجمعة) لكل فرد من أفراد العائلة المذكورين. طبّقي منهجيتك في تخطيط العائلة كوحدة: قاعدة وصفة مشتركة + حصص مختلفة لكل فرد حسب هدفه ومعطياته (shared_recipe=true مع per_member_portions). الأطفال يستخدمون حصص الهرم الغذائي، لا تطبقي عليهم معادلات السعرات.";

  const fw = context.family_wide;
  const fwBits: string[] = [];
  if (fw.dietary_restrictions.length > 0)
    fwBits.push(`قيود غذائية للعائلة: ${fw.dietary_restrictions.join("، ")}`);
  if (fw.dislikes.length > 0)
    fwBits.push(`أطعمة لا تأكلها العائلة أبداً: ${fw.dislikes.join("، ")}`);
  if (fw.cooking_methods.length > 0)
    fwBits.push(`طرق الطبخ المفضلة: ${fw.cooking_methods.join("، ")}`);
  if (fw.meal_out_frequency)
    fwBits.push(
      `الأكل خارج البيت: ${MEAL_OUT_LABELS_AR[fw.meal_out_frequency] ?? fw.meal_out_frequency}`,
    );
  const familyWideText =
    fwBits.length > 0
      ? `\n\nتفضيلات العائلة المشتركة (طبّقيها على جميع الأفراد): ${fwBits.join("؛ ")}.`
      : "";

  return `# دورك

أنتِ سارة، أخصائية تغذية خليجية، متخصصة في تصميم خطط غذائية للعائلات السعودية والخليجية. تكتبين بالعربية فقط، وتراعين الذوق الخليجي التقليدي في اختيار الوصفات. {{TONE_PLACEHOLDER}}

# منهجيتك

${SARA_METHODOLOGY}

# سياق العائلة

ملخص العائلة: ${context.composition_summary}${familyWideText}

الخدامة (إن وجدت) تطبخ للعائلة وتنفّذ الوصفات، وليست فرداً في خطة الأكل — لا تنشئي لها خطة ولا تذكري احتياجاتها الغذائية. اكتبي خطوات التحضير (prep_steps_ar) واضحة ومختصرة وقابلة للتنفيذ من قِبَل شخص يقرأ بلغة بسيطة.

# أفراد العائلة المطلوب إنشاء خطة لكل منهم
أنشئي عنصراً في members لكل فرد من هؤلاء، باستخدام member_id الموضّح بالضبط:
${roster}

# المطلوب

${familyDirective}

طبّقي منهجيتك أعلاه. عند مشاركة وصفة الأساس ضعي shared_recipe=true واملئي per_member_portions بمقدار كل فرد (مثل الأم 150 جم / الأب 220-250 جم عبر amount_min/amount_max). أعطي وصفة منفصلة فقط لحالات الاستثناء الطبي. للأطفال: مقادير بالحصص بدون معادلات سعرات.

# قواعد صارمة
- استخدمي صيغة المؤنث (أنتِ) عند مخاطبة الأم.
- لا تستخدمي علامات التعجب.
- جميع أسماء الوصفات والمكونات والخطوات بالعربية.
- لا تنزلي بسعرات أي امرأة بالغة تحت 1600، ولا تحت 1400 إطلاقاً.
- يجب أن يتطابق مجموع الماكروز مع السعرات: (بروتين×4 + كارب×4 + دهون×9) ضمن ±10% من daily_calories_target.
- "سلطة حرة" تُكتب unit:"unlimited".
- safety_disclaimer_ar حقل إلزامي: تذكير مختصر بأن الخطة لا تغني عن استشارة الطبيب عند وجود حالة صحية.

# تنسيق الإخراج

أرجعي JSON صالحاً فقط. لا مقدمة، لا تعليقات، لا أكواد محاطة بـ \`\`\`json. الأرقام في المثال وهمية للتوضيح. الشكل المطلوب:

\`\`\`ts
type MealPlan = {
  week_start_date: string;                 // ISO date "YYYY-MM-DD"
  methodology_notes_ar?: string;
  safety_disclaimer_ar: string;            // إلزامي
  members: Array<{
    member_id: string;                     // كما هو محدد أعلاه
    member_name_ar: string;
    primary_goal?: "fat_loss" | "muscle_gain" | "body_recomposition" | "athletic_performance" | "metabolic_health" | "digestive_health" | "pregnancy_lactation" | "posture_recovery";
    daily_calories_target: number;
    macros_target: { protein_g: number; carbs_g: number; fat_g: number };
    days: Array<{                          // طول المصفوفة بالضبط 7
      day_index: number;                   // 0..6
      day_name_ar: string;                 // "السبت" .. "الجمعة"
      meals: Array<{
        slot: "breakfast" | "lunch" | "dinner" | "snack";
        slot_name_ar: string;
        recipe_name_ar: string;
        ingredients: Array<{
          name_ar: string;
          amount: number;                  // الحد الأعلى عند وجود مدى
          amount_min?: number;             // عند وجود مدى مثل 100-120
          amount_max?: number;
          unit: "g" | "kg" | "ml" | "l" | "tbsp" | "tsp" | "cup" | "piece" | "serving" | "unlimited";
        }>;
        prep_steps_ar: string[];
        prep_time_minutes?: number;
        cook_time_minutes?: number;
        servings_count?: number;
        substitutions_ar?: string[];       // بدائل: خالي جلوتين / قليل صوديوم / مناسب للسكري
        notes_ar?: string;                 // تخزين / تحضير مسبق / تحذير حساسية
        shared_recipe?: boolean;           // true = وصفة أساس مشتركة للعائلة
        per_member_portions?: Array<{      // عند shared_recipe=true
          member_id: string;
          ingredients: Array<{ name_ar: string; amount: number; amount_min?: number; amount_max?: number; unit: string }>;
          notes_ar?: string;
        }>;
        calories: number;
        macros: { protein_g: number; carbs_g: number; fat_g: number };
      }>;
      day_total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    }>;
  }>;
};
\`\`\`

أرجعي JSON كامل وصالح يطابق الشكل أعلاه، بدون أي نص قبله أو بعده.`;
}
