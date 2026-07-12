import {
  getBeneficiaries,
  type PlanPromptContext,
  type PlanPromptContextMember,
} from "./buildContext";
import type { PlanSkeleton, LocaleCode } from "./schema";
import { DAY_NAMES_AR } from "./dates";

/**
 * Standalone translation prompt — translates an existing plan's meals into the
 * housekeeper's language (no generation). Names/amounts/units come from the
 * source; only the human-readable strings are translated.
 */
export function buildTranslatePrompt(
  items: {
    i: number;
    recipe_name_ar: string;
    ingredient_names: string[];
    prep_steps_ar: string[];
  }[],
  locale: LocaleCode,
): string {
  const name = HK_LANG_NAMES[locale] ?? locale;
  return `# دورك
أنتِ مترجمة محترفة لوصفات الطبخ. تترجمين من العربية إلى ${name} ترجمة طبيعية عملية — كأنك تكتبين لطبّاخة تقرأ ${name} كلغة أم. تجنّبي الترجمة الحرفية، وحافظي على نفس المعنى والمقادير.

# العناصر المطلوب ترجمتها
\`\`\`json
${JSON.stringify(items)}
\`\`\`

# الإخراج
أرجعي JSON صالحاً فقط (لا نص قبله/بعده، لا أكواد محاطة بغير اللازم): مصفوفة بنفس عدد العناصر وبنفس قيم i:
\`\`\`ts
type Out = Array<{
  i: number;                    // كما في المدخل
  recipe_name: string;          // اسم الطبق بـ ${name}
  ingredient_names: string[];   // أسماء المكونات بـ ${name} — نفس العدد والترتيب
  steps: string[];              // خطوات الطبخ بـ ${name} — نفس العدد والترتيب
}>;
\`\`\``;
}

/**
 * Standalone name-transliteration prompt — renders family members' personal
 * names in the housekeeper's language/script (how she'd read the name aloud),
 * NOT a meaning translation.
 */
export function buildNameTranslatePrompt(
  names: { i: number; name_ar: string }[],
  locale: LocaleCode,
): string {
  const name = HK_LANG_NAMES[locale] ?? locale;
  return `# دورك
أنتِ مساعدة تكتب أسماء الأشخاص بحروف لغة أخرى. حوّلي كل اسم شخص من العربية إلى كتابته بـ ${name} كما يُنطق (نقل صوتي/transliteration) — وليس ترجمة معناه. اكتبي الاسم بحروف ${name} كما تقرؤه طبّاخة تعرف ${name} فقط.

# الأسماء
\`\`\`json
${JSON.stringify(names)}
\`\`\`

# الإخراج
أرجعي JSON صالحاً فقط (لا نص قبله/بعده): مصفوفة بنفس عدد العناصر وبنفس قيم i:
\`\`\`ts
type Out = Array<{
  i: number;       // كما في المدخل
  name: string;    // الاسم بحروف ${name}
}>;
\`\`\``;
}

// Human-readable names for the housekeeper's language, interpolated into the
// day-expansion translation directive. (ar is never a translation target.)
const HK_LANG_NAMES: Record<LocaleCode, string> = {
  ar: "العربية",
  en: "English",
  tl: "Tagalog (Filipino)",
  id: "Bahasa Indonesia",
  bn: "Bengali (বাংলা)",
  am: "Amharic (አማርኛ)",
  ur: "Urdu (اردو)",
};

const ROLE_LABELS_AR: Record<string, string> = {
  dad: "الزوج",
  son: "ابن",
  daughter: "ابنة",
  housekeeper: "الخادمة",
  other_adult: "فرد بالغ",
  other_child: "طفل آخر",
};

// MOH-aligned bucket names — identical wording to the methodology's multiplier
// table (خامل ×1.2 … عالي جداً ×1.9) so the model never has to infer the match.
const ACTIVITY_LABELS_AR: Record<string, string> = {
  sedentary: "خامل (كثير الجلوس)",
  light: "نشاط خفيف (1-3 أيام أسبوعياً)",
  moderate: "نشاط متوسط (3-5 أيام أسبوعياً)",
  active: "نشاط عالي (6-7 أيام أسبوعياً)",
  very_active: "نشاط عالي جداً (تدريب مكثف/عمل بدني)",
};

const DAY_NATURE_LABELS_AR: Record<string, string> = {
  desk: "مكتبية (جلوس معظم اليوم)",
  moderate_movement: "حركة متوسطة",
  physical_work: "عمل بدني",
};

const EXERCISE_DAYS_LABELS_AR: Record<string, string> = {
  none: "لا رياضة",
  d1_2: "رياضة 1-2 يوم أسبوعياً",
  d3_5: "رياضة 3-5 أيام أسبوعياً",
  d6_plus: "رياضة 6 أيام أو أكثر أسبوعياً",
};

const EXERCISE_TYPE_LABELS_AR: Record<string, string> = {
  resistance: "مقاومة",
  cardio: "كارديو",
  mixed: "مقاومة وكارديو",
};

const WATER_LITERS_LABELS_AR: Record<string, string> = {
  lt1: "أقل من لتر",
  l1_2: "1-2 لتر",
  l2_3: "2-3 لترات",
  gt3: "أكثر من 3 لترات",
};

const FEEDING_MODE_LABELS_AR: Record<string, string> = {
  exclusive: "طبيعية كاملة",
  mixed: "مختلطة",
  formula: "صناعية",
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
  arabic: "عربي",
  asian: "آسيوي",
  western: "غربي",
  varied: "متنوع",
  // Legacy values (pre-00016 remap) — still resolvable until prod migrates.
  mixed: "خليط من الخليجي والعالمي",
  mediterranean: "متوسطي",
  international: "عالمي",
};

const SLEEP_BAND_LABELS_AR: Record<string, string> = {
  lt5: "أقل من 5 ساعات",
  h5_6: "5-6 ساعات",
  h7_8: "7-8 ساعات",
  gt8: "أكثر من 8 ساعات",
};

function labeled(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "غير محدد";
  return map[key] ?? key;
}

function describeMom(c: PlanPromptContext): string {
  const m = c.mom;
  // The account owner is female by default; a male owner (الجنس asked at
  // onboarding) flips the clause's grammar and the BMR formula pick. The
  // imperatives addressed to Sara herself (طبّقي، نسّقي…) stay feminine.
  const male = m.sex === "male";
  const g = (f: string, mm: string) => (male ? mm : f);
  const parts: string[] = [];
  parts.push(
    `${g("العميلة (الأم)", "العميل (رب الأسرة)")}: ${m.display_name ?? "غير معروف"}`,
  );
  parts.push(g("أنثى", "ذكر — استخدمي معادلة BMR للذكر"));
  if (m.age != null) parts.push(`${m.age} سنة`);
  if (m.height_cm != null) parts.push(`${g("طولها", "طوله")} ${m.height_cm} سم`);
  if (m.weight_kg != null) parts.push(`${g("وزنها", "وزنه")} ${m.weight_kg} كيلو`);
  parts.push(`${g("نشاطها", "نشاطه")} ${labeled(ACTIVITY_LABELS_AR, m.activity_level)}`);
  parts.push(`${g("هدفها", "هدفه")} ${labeled(GOAL_LABELS_AR, m.primary_goal)}`);

  let line = parts.join("، ") + ".";

  if (m.medical_conditions.length > 0) {
    line += ` ${g("تعاني", "يعاني")} من: ${m.medical_conditions.join("، ")} — طبّقي قواعد الحالة الصحية المناسبة.`;
  } else {
    line += g(" لا تعاني من حالات صحية.", " لا يعاني من حالات صحية.");
  }
  if (m.is_pregnant) {
    const stage =
      m.pregnancy_month != null
        ? `الشهر ${m.pregnancy_month}، الثلث ${m.pregnancy_trimester ?? "غير محدد"}`
        : `الثلث ${m.pregnancy_trimester ?? "غير محدد"}`;
    line += ` حامل (${stage})${m.high_risk_pregnancy ? " — حمل عالي الخطورة" : ""} — طبّقي قواعد الحمل.`;
  }
  if (m.months_postpartum != null) {
    const feeding = m.feeding_mode
      ? `${labeled(FEEDING_MODE_LABELS_AR, m.feeding_mode)}، `
      : "";
    line += ` مرضعة (${feeding}عمر الطفل ${m.months_postpartum} شهر) — طبّقي قواعد الرضاعة.`;
  }
  if (m.dietary_restrictions.length > 0) {
    line += ` قيود غذائية: ${m.dietary_restrictions.join("، ")}.`;
  }
  if (m.allergies.length > 0) {
    line += ` حساسية: ${m.allergies.join("، ")} — تجنّبيها تماماً.`;
  }
  if (m.never_eat_foods && m.never_eat_foods.length > 0) {
    line += ` أطعمة ${g("لا تتناولها", "لا يتناولها")} نهائياً: ${m.never_eat_foods.join("، ")} — استبعديها تماماً مثل الحساسية.`;
  }
  if (m.dislikes.length > 0) {
    line += ` ${g("لا تحب", "لا يحب")}: ${m.dislikes.join("، ")}.`;
  }
  if (m.deep_dive && m.deep_dive.liked_foods.length > 0) {
    line += ` ${g("تحب", "يحب")}: ${m.deep_dive.liked_foods.join("، ")} — وظّفيها في الخطة.`;
  }
  // Coach questionnaire (00013). Raw exercise answers ride with the derived
  // level so the TDEE multiplier match is explicit, not inferred.
  if (m.target_weight_kg != null) {
    line += ` ${g("هدفها", "هدفه")} الوصول إلى ${m.target_weight_kg} كيلو — اجعلي وتيرة التغيير واقعية ومستدامة.`;
  }
  if (m.day_nature || m.exercise_days) {
    const bits: string[] = [];
    if (m.day_nature) bits.push(`طبيعة ${g("يومها", "يومه")} ${labeled(DAY_NATURE_LABELS_AR, m.day_nature)}`);
    if (m.exercise_days) {
      const t = m.exercise_type ? ` (${labeled(EXERCISE_TYPE_LABELS_AR, m.exercise_type)})` : "";
      bits.push(`${labeled(EXERCISE_DAYS_LABELS_AR, m.exercise_days)}${t}`);
    }
    line += ` ${bits.join("، ")} — مستوى النشاط أعلاه محتسب من ذلك.`;
  }
  if (m.medications.length > 0) {
    line += ` ${g("تتناول", "يتناول")} أدوية: ${m.medications.join("، ")} — نسّقي توقيت الوجبات مع الدواء وفق قواعد الحالة الصحية، ولا تقدّمي أي نصيحة دوائية.`;
  }
  if (m.supplements.length > 0) {
    line += ` ${g("تتناول", "يتناول")} مكملات: ${m.supplements.join("، ")} — راعيها في توزيع الوجبات (مثل فصل الحديد عن الكالسيوم).`;
  }
  if (m.nausea_foods.length > 0) {
    line += ` أطعمة تسبب ${g("لها", "له")} الغثيان حالياً: ${m.nausea_foods.join("، ")} — تجنّبيها مؤقتاً في هذه الخطة.`;
  }
  if (m.water_liters) {
    const low = m.water_liters === "lt1" || m.water_liters === "l1_2";
    line += ` ${g("تشرب", "يشرب")} ${labeled(WATER_LITERS_LABELS_AR, m.water_liters)} من الماء يومياً${low ? ` — ${g("شجّعيها", "شجّعيه")} بلطف على الزيادة ضمن الخطة` : ""}.`;
  } else if (m.water_cups != null) {
    line += ` ${g("تشرب", "يشرب")} نحو ${m.water_cups} أكواب ماء يومياً${m.water_cups < 8 ? ` — ${g("شجّعيها", "شجّعيه")} بلطف على الزيادة ضمن الخطة` : ""}.`;
  }
  if (m.sleep_band) {
    const lowSleep = m.sleep_band === "lt5" || m.sleep_band === "h5_6";
    line += ` ${g("تنام", "ينام")} ${labeled(SLEEP_BAND_LABELS_AR, m.sleep_band)} يومياً${lowSleep ? " — راعي وجبات مسائية خفيفة تدعم نوماً أفضل" : ""}.`;
  } else if (m.sleep_hours != null) {
    line += ` ${g("تنام", "ينام")} نحو ${m.sleep_hours} ساعات${m.sleep_hours < 7 ? " — راعي وجبات مسائية خفيفة تدعم نوماً أفضل" : ""}.`;
  }
  line += ` ${g("تفضل", "يفضل")} مطبخ ${labeled(CUISINE_LABELS_AR, m.cuisine_preference)}.`;
  // meal_mode is discretionary: 'shared' is the default (cook once, split), so it
  // needs no instruction. Only flag 'independent' — and it must be surfaced HERE,
  // in the roster the SKELETON sees, because the skeleton is the phase that decides
  // which dishes are shared (same recipe_name_ar = shared). Without it the skeleton
  // gives mom the family's shared dish names and she stays grouped as shared even
  // after switching to independent. Mirrors describeMember (feminine phrasing).
  if (m.meal_mode === "independent") {
    line += g(
      " (وجبات مستقلة: أعطيها أطباقاً خاصة بها بأسماء مختلفة عن باقي العائلة، إلا إذا تعارض مع حالة طبية/حساسية/حمل فالصحة أولاً.)",
      " (وجبات مستقلة: أعطيه أطباقاً خاصة به بأسماء مختلفة عن باقي العائلة، إلا إذا تعارض مع حالة طبية/حساسية فالصحة أولاً.)",
    );
  }

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
    if (member.feeding_mode) {
      line += ` طريقة الرضاعة: ${labeled(FEEDING_MODE_LABELS_AR, member.feeding_mode)}${
        member.feeding_mode === "exclusive"
          ? " — احتياج سعرات الرضاعة كامل."
          : " — عدّلي إضافة سعرات الرضاعة بما يناسب."
      }`;
    }
  }
  // Coach questionnaire (00013) — masculine default phrasing like the rest of
  // the member block; nausea only ever arrives on pregnant members.
  if (member.target_weight_kg != null) {
    line += ` هدفه الوصول إلى ${member.target_weight_kg} كيلو — اجعلي وتيرة التغيير واقعية ومستدامة.`;
  }
  if (member.day_nature || member.exercise_days) {
    const bits: string[] = [];
    if (member.day_nature)
      bits.push(`طبيعة يومه ${labeled(DAY_NATURE_LABELS_AR, member.day_nature)}`);
    if (member.exercise_days) {
      const t = member.exercise_type
        ? ` (${labeled(EXERCISE_TYPE_LABELS_AR, member.exercise_type)})`
        : "";
      bits.push(`${labeled(EXERCISE_DAYS_LABELS_AR, member.exercise_days)}${t}`);
    }
    line += ` ${bits.join("، ")} — مستوى النشاط أعلاه محتسب من ذلك.`;
  }
  if (member.medications.length > 0) {
    line += ` يتناول أدوية: ${member.medications.join("، ")} — نسّقي توقيت الوجبات مع الدواء وفق قواعد الحالة الصحية، ولا تقدّمي أي نصيحة دوائية.`;
  }
  if (member.supplements.length > 0) {
    line += ` يتناول مكملات: ${member.supplements.join("، ")} — راعيها في توزيع الوجبات.`;
  }
  if (member.nausea_foods.length > 0) {
    line += ` أطعمة تسبب لها الغثيان حالياً: ${member.nausea_foods.join("، ")} — تجنّبيها مؤقتاً في هذه الخطة.`;
  }
  if (member.water_liters) {
    line += ` يشرب ${labeled(WATER_LITERS_LABELS_AR, member.water_liters)} من الماء يومياً.`;
  } else if (member.water_cups != null) {
    line += ` يشرب نحو ${member.water_cups} أكواب ماء يومياً.`;
  }
  if (member.sleep_hours != null) {
    line += ` ينام نحو ${member.sleep_hours} ساعات.`;
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
  // meal_mode is discretionary: 'shared' is the default family behavior (cook once,
  // split), so it needs no extra instruction. Only flag 'independent' as the exception.
  if (member.meal_mode === "independent") {
    line +=
      " (وجبات مستقلة: أعطه أطباقاً خاصة به بأسماء مختلفة عن باقي العائلة، إلا إذا تعارض مع حالة طبية/حساسية/حمل فالصحة أولاً.)";
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

## تعديل السعرات حسب الهدف (قاعدة لكل جنس — توجيه الكوتش 07/2026)
للنساء:
- نزول الوزن: TDEE − 300 إلى 500 سعرة
- زيادة العضل: TDEE + 200 إلى 300 سعرة (أو +10-12% للزيادة النظيفة)
للرجال:
- نزول الوزن (تنشيف): TDEE − 15% إلى 20%
- زيادة العضل (ضخامة): TDEE + 10% إلى 15%
للجنسين:
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
الوجبات تُطبخ مرة واحدة وتُقسَّم على العائلة. لا تكتبي وصفة منفصلة لكل فرد افتراضياً.

1) جمّعي قبل الطبخ: لكل وجبة، حدّدي مَن من الأفراد يناسبهم نفس الطبق حسب هدفه (سعرات، ماكروز، حساسيات، قيود، تفضيلات). يشترك الأفراد في وصفة واحدة حتى لو احتاجوا **كميات** مختلفة منها. ادمجي فرداً في وصفة مشتركة فقط حين يناسبه الطبق فعلاً؛ ومَن يحتاج وجبة مختلفة جذرياً (حساسية، أو ماكروز لا يحققها الطبق) اتركيه خارج الوصفة المشتركة وأعطيه وصفته الخاصة. لا تُجبري الجميع على طبق واحد.

2) وصفة واحدة مقيّسة للمجموعة: لكل وجبة مشتركة اكتبي وصفة واحدة تُطبخ مرة واحدة للجميع. قيّسي كل المكونات لكمية المجموعة الكاملة، واذكري الوزن النهائي الإجمالي للطبق في batch_finished_weight_g.

3) قسّمي الكمية لكل فرد: في per_member_portions، لكل فرد يشارك الطبق اذكري حصته بالجرام (portion_grams) **و** كنسبة مئوية من إجمالي الكمية (portion_percentage). مجموع النسب للمشاركين ≈ 100٪. هكذا يحقق كل فرد هدفه المختلف من نفس القِدر — حصص أكبر أو أصغر من الطبق نفسه، لا طبخ منفصل. استخدمي notes_ar فقط لإضافة حقيقية (مثل مصدر دهون صحية إضافي)، لا لإعادة كتابة الوصفة.

مثال (عشاء دجاج وأرز، إجمالي الكمية 1800 جم):
- الأب: 630 جم (35٪)
- الأم: 450 جم (25٪)
- المراهق: 540 جم (30٪)
- الطفل: 180 جم (10٪)

للأطفال: حصة مناسبة للعمر والحاجة، بدون معادلات سعرات.
خصّصي لها خطة منفصلة تماماً (ليست أساساً مشتركاً) فقط في هذه الحالات: سكري يتطلب ضبطاً دقيقاً، حساسية أو عدم تحمّل طعام، مشاكل هضم شديدة، الحمل أو الرضاعة، أو اختلاف جذري في الأهداف. مَن لا يناسبه الطبق المشترك يأخذ وصفته الخاصة لتلك الوجبة بنفس الطريقة.

## الحد الأدنى لكل وصفة
لكل وصفة: اسم واضح، قائمة مكونات كاملة، مقادير دقيقة (جرامات/ملاعق/أكواب وليس تقديرات غامضة)، خطوات تحضير واضحة، وقت التحضير + وقت الطبخ، عدد الحصص، القيم الغذائية للحصة (سعرات/بروتين/كارب/دهون)، وبدائل/تعديلات (خالي جلوتين، قليل صوديوم، مناسب للسكري...). واختيارياً: ملاحظات تخزين/تحضير مسبق/تحذير حساسية.

## الحدود الآمنة
- المرأة البالغة: الحد الأدنى 1600 سعرة/يوم في الظروف الطبيعية.
- أقل من 1400 سعرة/يوم: يتطلب تبريراً صريحاً وإشرافاً مختصاً — لا تنزلي تحته.
- 1500 سعرة: مقبول فقط إذا دعمه حساب TDEE وكانت الماكروز والمغذيات كافية وبدون أعراض.
هذه الحدود للبالغين فقط — الأطفال يُخطَّط لهم بالحصص لا بالسعرات.

## الحالات التي تتطلب طبيباً قبل الخطة
حمل/رضاعة عالي الخطورة يحتاج تدخلاً غذائياً خاصاً، سكري غير مستقر، ضغط غير منضبط، أمراض قلب/كلى/كبد، اضطراب غدة درقية غير مستقر، حساسية طعام شديدة، اضطراب هضمي حاد/غير مشخّص، اضطرابات الأكل، تعافٍ بعد جراحة/حالة طبية خاصة، أو أي أعراض غير مفسّرة تحتاج تشخيصاً. المبدأ: إذا تجاوزت الحالة نطاق التخطيط الغذائي الآمن، الطبيب أولاً ثم تُبنى الخطة حول الحالة.`;

// Sara's cookbook ("كنز الوصفات الصحية") — STYLE inspiration only (no recipes
// are extracted). Layered AFTER the methodology: methodology = how to calculate
// (and takes precedence for medical/pregnancy needs); cookbook = how to express.
const SARA_COOKBOOK = `# كتابك المرجعي للوصفات

أنتي مؤلفة كتاب طبخ شعبي اسمه "كنز الوصفات الصحية" يحتوي على ١٠١ وصفة صحية. هذا الكتاب يمثل أسلوبك في الطبخ الصحي، واللي تستخدمينه مع عميلاتك. لما تنشئين الخطة، خلي الوصفات تطلع بنفس روح هذا الكتاب وأسلوبه.

## الفلسفة الأساسية للكتاب

**"غني بالبروتين، خالي من السكر والدقيق"** — هذا الشعار يحدد كل اختياراتك:

١. كل وصفة لازم تحتوي على مصدر بروتين واضح (٦-٣٦ جرام لكل حصة، الأغلب ١٠-٢٥ جرام)
٢. ممنوع السكر المضاف — استخدمي العسل، التمر، فاكهة طازجة كبدائل
٣. ممنوع الطحين الأبيض المكرر — استخدمي بدائله: الشوفان، الكينوا، البرغل، الساوردو، الحبوب الكاملة
٤. مكونات متوفرة في كل بيت خليجي، لا تستخدمي مكونات نادرة أو غالية بدون داعي

## النطاق الحراري والماكروز للوصفة الواحدة

- السعرات لكل حصة: عادة ١٢٠-٤٣٠ كالوري (الأغلبية في نطاق ٢٠٠-٣٢٠)
- البروتين: ١٠-٢٥ جرام عادة، قد يصل ٣٦ في وصفات الدجاج/اللحم
- الألياف: ٣-١٦ جرام (مهم تذكرين القيمة في وصف القيمة الغذائية)
- الكاربوهيدرات: ١٢-٣٦ جرام عادة
- الدهون: ٧-٢٠ جرام

## المكونات اللي تستخدمينها بشكل متكرر

**حبوب وكاربوهيدرات:**
- البرغل (خشن أو ناعم، مطبوخ أو منقوع)
- الشوفان (مطحون أو حب كامل)
- الكينوا (مطبوخة)
- خبز الساوردو (شرائح أو خبز مدور)
- الحبوب الكاملة

**بروتينات:**
- صدر دجاج (مشوي، مكعبات، شرائح)
- البيض (مسلوق، مقلي بزيت قليل، أومليت)
- التونة (معلبة مصفاة من الماء)
- الحمص المسلوق
- اللبنة والجبن قليل الدسم (شيدر، موزاريلا، فيتا)

**خضار رئيسية:**
- الطماطم (طازجة، كرزية، مجففة)
- الخيار
- البصل (أبيض أو أخضر)
- البقدونس والنعناع (طازج أو مجفف)
- السبانخ (طازجة)
- الأفوكادو
- الجرجير
- البربير (بقلة حساوية)
- الذرة
- الفلفل الأحمر والأخضر

**نكهات ومحسنات:**
- زيت زيتون
- عصير الليمون الطازج
- دبس الرمان
- الرمان (حبوب)
- الثوم المهروس
- السماق
- الكمون
- الزعتر والأوريغانو
- الفلفل الأسود
- الملح (بكميات معتدلة)

**اختياريات (للاستخدام بكميات صغيرة):**
- التمر (محشو أو مفروم كبديل سكر)
- العسل (نصف ملعقة كحد أقصى)
- المكسرات والبذور (للزينة فقط، ٧-١٠ جرام)
- جبن الفيتا (٣٠ جرام كحد أقصى)

## أسلوب كتابة الوصفة

**العنوان:** قصير ومباشر، يذكر المكون الرئيسي والمكونات المميزة.
أمثلة من كتابك:
- "سلطة البرغل بالحمص والطماطم المجففة"
- "سلطة دجاج بالأفوكادو والكينوا"
- "بان كيك مالح بالشوفان والبيض والسبانخ"
- "بيتزا فطور الساوردو والبيض"
- "توست ساوردو بالبيض المسلوق والسبانخ"

**المكونات (ingredients):**
- استخدمي مقادير دقيقة بالأكواب، الملاعق، أو الجرامات
- اشرحي الحالة (مطبوخ، منقوع، مفروم، مكعبات، شرائح)
- اذكري البدائل بين قوسين (نباتي أو عادي، شيدر أو موزاريلا)
- ضعي "اختياري" على المكونات الزينة أو المحسنات

**خطوات التحضير (prep_steps_ar):**
- ٣-٦ خطوات عادة (وصفات بسيطة)، قد تصل ٧-٨ للوصفات المعقدة
- كل خطوة جملة واحدة قصيرة وعملية
- تبدأ بفعل أمر مؤنث (اخلطي، أضيفي، سخّني، قطعي، قلّبي)
- خطوة أخيرة دائماً للتقديم: "قدّميها باردة" / "قدّميها دافئة" / "قدّميها فورًا"

**القيمة الغذائية:**
- لا تكتفي بالسعرات والماكروز — أضيفي الألياف
- لما يكون مناسب، اذكري فائدة صحية مختصرة في notes_ar
- مثال: "البربير غني بالأوميغا ٣ والمغنيسيوم، كما يعزز من صحة القلب"

## أنواع الوصفات في كتابك (لا تتقيدي بها حصرياً، لكن استلهمي منها)

**سلطات (الأكثر تكراراً):**
- سلطة البرغل بأنواعها (بالحمص والطماطم المجففة / بالخضار والليمون)
- سلطة الحمص (بالتونة، بالخضار)
- سلطة الدجاج (بالأفوكادو والكينوا، بالخضار)
- سلطة البربير
- سلطات الورقيات مع البروتين

**وصفات الفطور:**
- بان كيك مالح بالشوفان والبيض
- توست الساوردو بأنواعه
- بيتزا الفطور بقاعدة الساوردو
- البيض المسلوق مع الخضار

**وصفات أساسية (غداء/عشاء):**
- دجاج مشوي مع كينوا أو برغل وسلطة
- سمك مشوي مع خضار
- حساء العدس مع خبز ساوردو
- مكرونة الحبوب الكاملة بصلصة بسيطة

**وجبات خفيفة:**
- لبنة مع زعتر وخبز ساوردو
- حمص بطحينة مع خضار طازجة
- بيض مسلوق مع خيار وطماطم
- مكسرات وبذور بكميات محسوبة

## قواعد محورية للتطابق مع روح الكتاب

١. **لا تستخدمي أرز أبيض كمكون رئيسي** — استبدليه بالكينوا، البرغل، أو الشوفان كلما أمكن
٢. **لا تستخدمي مكرونة عادية** — استخدمي مكرونة الحبوب الكاملة فقط
٣. **لا تستخدمي خبز أبيض** — الساوردو، الحبوب الكاملة، أو شراك القمح الكامل
٤. **لا تستخدمي سكر مضاف** — العسل قليلاً، التمر، فاكهة طازجة
٥. **لا تستخدمي مقليات بزيت غزير** — شوي، خبيز، طبخ بالبخار، أو قلي بقطرات زيت
٦. **زيت الزيتون هو الدهن الأساسي** — استخدميه بكميات معتدلة (ملعقة كبيرة لكل وصفة عادة)
٧. **الخضار الورقية والمكونات الطازجة موجودة في معظم الوصفات** — حتى الفطور
٨. **ذكري دائماً الفائدة الصحية** عندما يكون للوصفة مكون مميز (سمك = أوميغا، أفوكادو = دهون صحية، إلخ)`;

/**
 * Static system prefix — identical across the skeleton call AND every per-day
 * call, so it's sent as a cached block (streamAnthropic's systemStatic).
 * {{TONE_PLACEHOLDER}} is filled later (Email 2).
 */
export const STATIC_SYSTEM = `# دورك

أنتِ سارة، أخصائية تغذية خليجية، متخصصة في تصميم خطط غذائية للعائلات السعودية والخليجية. تكتبين بالعربية فقط، وتراعين الذوق الخليجي التقليدي في اختيار الوصفات. {{TONE_PLACEHOLDER}}

# منهجيتك

${SARA_METHODOLOGY}

${SARA_COOKBOOK}`;

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
                meal_mode: "shared",
                target_weight_kg: null,
                day_nature: null,
                exercise_days: null,
                exercise_type: null,
                water_cups: null,
                water_liters: null,
                sleep_hours: null,
                medications: [],
                supplements: [],
                nausea_foods: [],
                feeding_mode: null,
              },
            );
      return `- member_id="${b.member_id}" — ${desc}`;
    })
    .join("\n");
}

// Cooking-method slugs → Arabic (the stored values are English tokens; the
// prompt should read as فصحى, not slugs).
const COOKING_LABELS_AR: Record<string, string> = {
  grilling: "شوي",
  boiling: "سلق",
  steaming: "طبخ بالبخار",
  baking: "فرن",
  air_fryer: "مقلاة هوائية",
  frying_minimal: "قلي بزيت قليل",
  deep_frying: "قلي عميق",
};

function familyWideText(context: PlanPromptContext): string {
  const fw = context.family_wide;
  const bits: string[] = [];
  if (fw.dietary_restrictions.length > 0)
    bits.push(`قيود غذائية للعائلة: ${fw.dietary_restrictions.join("، ")}`);
  if (fw.dislikes.length > 0)
    bits.push(`أطعمة لا تأكلها العائلة أبداً: ${fw.dislikes.join("، ")}`);
  if (fw.cooking_methods.length > 0)
    bits.push(
      `طرق الطبخ المفضلة: ${fw.cooking_methods.map((c) => COOKING_LABELS_AR[c] ?? c).join("، ")}`,
    );
  if (fw.meal_out_frequency)
    bits.push(
      `الأكل خارج البيت: ${MEAL_OUT_LABELS_AR[fw.meal_out_frequency] ?? fw.meal_out_frequency}`,
    );
  return bits.length > 0
    ? `\n\nتفضيلات العائلة المشتركة (طبّقيها على الجميع): ${bits.join("؛ ")}.`
    : "";
}

/**
 * The user's regeneration feedback ("what's wrong / what to improve"), layered
 * in as guidance. Methodology + cookbook stay first, so they take precedence;
 * this adapts the new plan to the user without breaking the core rules.
 */
function feedbackText(context: PlanPromptContext): string {
  const fb = context.user_feedback?.trim();
  if (!fb) return "";
  return `\n\n# ملاحظات العميلة (راعيها في هذه الخطة الجديدة)
${fb}
طبّقي هذه الملاحظات قدر الإمكان مع الحفاظ على منهجيتك وأسلوب كتابك وبنية الوصفات والقواعد الصحية.`;
}

const DEEP_DIVE_LABELS: Array<{
  key: keyof import("./buildContext").DeepDiveFields;
  label: string;
  map?: Record<string, string>;
}> = [
  { key: "waist_cm", label: "محيط الخصر (سم)" },
  { key: "hip_cm", label: "محيط الورك (سم)" },
  { key: "steps_daily", label: "متوسط الخطوات اليومية" },
  {
    key: "exercise_duration",
    label: "مدة التمرين",
    map: { lt30: "أقل من 30 دقيقة", m30_60: "30-60 دقيقة", gt60: "أكثر من 60 دقيقة" },
  },
  { key: "meals_per_day", label: "عدد الوجبات المفضل يومياً" },
  { key: "snacks_habit", label: "وجبات خفيفة", map: { yes: "نعم", no: "لا" } },
  {
    key: "breakfast_habit",
    label: "الإفطار",
    map: { regular: "بانتظام", sometimes: "أحياناً", never: "لا تتناوله" },
  },
  {
    key: "intermittent_fasting",
    label: "صيام متقطع",
    map: { yes: "نعم", no: "لا" },
  },
  { key: "food_recall_24h", label: "أكل آخر 24 ساعة" },
  {
    key: "sleep_quality",
    label: "جودة النوم",
    map: { excellent: "ممتازة", good: "جيدة", fair: "متوسطة", poor: "ضعيفة" },
  },
  {
    key: "stress_level",
    label: "مستوى التوتر",
    map: { low: "منخفض", medium: "متوسط", high: "مرتفع" },
  },
  {
    key: "who_cooks",
    label: "من يطبخ غالباً",
    map: { me: "هي بنفسها", family_member: "أحد أفراد الأسرة", cook: "طاهٍ/خدامة", delivery: "طلب خارجي غالباً" },
  },
  {
    key: "cooking_time",
    label: "وقت الطبخ المتاح يومياً",
    map: { lt20: "أقل من 20 دقيقة", m20_40: "20-40 دقيقة", gt40: "أكثر من 40 دقيقة" },
  },
  { key: "previous_diets", label: "حميات سابقة (وما نجح/لم ينجح)" },
  { key: "food_budget", label: "ميزانية الطعام" },
];

/**
 * The mom's optional deep-dive lifestyle answers. SKELETON-only: they shape
 * targets/meal-count/structure once; day prompts never repeat them.
 * liked_foods renders inside describeMom instead (positive steer clause).
 */
function deepDiveText(context: PlanPromptContext): string {
  const dd = context.mom.deep_dive;
  if (!dd) return "";
  const lines: string[] = [];
  for (const { key, label, map } of DEEP_DIVE_LABELS) {
    const v = dd[key];
    if (v == null || v === "" || Array.isArray(v)) continue;
    const rendered = typeof v === "string" && map ? (map[v] ?? v) : String(v);
    lines.push(`- ${label}: ${rendered}`);
  }
  if (lines.length === 0) return "";
  return `\n\n# نمط حياة العميلة (تفاصيل إضافية من الاستبيان)
${lines.join("\n")}
راعيها في توزيع الوجبات وأسلوب الطبخ والتنويع، مع بقاء المنهجية والقواعد الصحية أولاً.`;
}

/**
 * The mom's free "anything else" questionnaire note. SKELETON-only (like
 * feedback): targets/structure are decided there, and day prompts repeat 7×.
 * Methodology still takes precedence.
 */
function momNotesText(context: PlanPromptContext): string {
  const n = context.mom.notes?.trim();
  if (!n) return "";
  return `\n\n# ملاحظات إضافية من العميلة (من الاستبيان)
${n}
راعيها قدر الإمكان مع الحفاظ على منهجيتك والقواعد الصحية.`;
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
    : "عندما تكون الوجبة نفسها مشتركة بين أكثر من فرد، استخدمي **نفس** recipe_name_ar لهم حتى نوسّعها لاحقاً كوصفة عائلة واحدة بحصص مختلفة. مَن وُسم بـ(وجبات مستقلة) في القائمة أعطيه أطباقاً بأسماء مختلفة عن البقية.";

  return `# سياق العائلة

ملخص العائلة: ${context.composition_summary}${familyWideText(context)}

الخدامة (إن وجدت) تطبخ وتنفّذ الوصفات، وليست فرداً في الخطة.

# أفراد الخطة المطلوبة الآن (استخدمي member_id بالضبط)
${buildRoster(context, targetMemberIds)}${deepDiveText(context)}${momNotesText(context)}${feedbackText(context)}

# المطلوب (المرحلة 1: الهيكل فقط)
احسبي لكل بالغ هدفه اليومي (سعرات + ماكروز) حسب منهجيتك (Mifflin-St Jeor + النشاط + الهدف + توزيع الماكروز). الأطفال: ضعي daily_calories_target تقديرياً (الخطة لهم بالحصص).
ثم خطّطي **أسبوعاً كاملاً (7 أيام متتالية)** من **أسماء الأطباق الخليجية فقط** لكل فرد — متنوّعة عبر الأيام، بدون مكونات أو خطوات. ${sharedNote}

# الإخراج
أرجعي JSON صالحاً فقط (لا نص قبله/بعده، لا أكواد محاطة). الشكل:
\`\`\`ts
type Skeleton = {
  safety_disclaimer_ar: string;            // تذكير مختصر بأن الخطة لا تغني عن الطبيب
  methodology_notes_ar?: string;
  members: Array<{
    member_id: string;                     // كما هو أعلاه
    primary_goal?: "fat_loss"|"muscle_gain"|"body_recomposition"|"athletic_performance"|"metabolic_health"|"digestive_health"|"pregnancy_lactation"|"posture_recovery"|"maintain"|"general_health";
    daily_calories_target: number;
    macros_target: { protein_g: number; carbs_g: number; fat_g: number };
    days: Array<{                          // 7 عناصر
      day_index: number;                   // 0..6 (0 = أول يوم في الخطة)
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
  dayNameOverride?: string,
): string {
  const dayName = dayNameOverride ?? DAY_NAMES_AR[dayIndex] ?? `اليوم ${dayIndex + 1}`;
  const isSolo = skeleton.members.length === 1;

  // Housekeeper translation is NOT produced in this call. Generating each recipe
  // twice (Arabic + fully translated, amounts and all) here roughly DOUBLED output
  // tokens for maid households. Translation now runs only as a separate LEAN pass
  // (buildTranslatePrompt → names + steps, no re-emitted amounts/macros): the
  // background function calls translateMealPlan at end-of-run for maid households,
  // and the maid view re-triggers it on demand. So the day prompt stays Arabic-only.

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
        sm.member_id === "mom"
          ? // never-eat foods are hard exclusions like allergies — they must
            // repeat in every day prompt, not just the skeleton roster.
            [...context.mom.allergies, ...(context.mom.never_eat_foods ?? [])]
          : (ctxMember?.allergies ?? []);
      const dislikes =
        sm.member_id === "mom" ? context.mom.dislikes : (ctxMember?.dislikes ?? []);
      const conditions =
        sm.member_id === "mom"
          ? context.mom.medical_conditions
          : (ctxMember?.medical_conditions ?? []);
      if (allergies.length) constraints.push(`حساسية (تجنّب تام): ${allergies.join("، ")}`);
      if (dislikes.length) constraints.push(`لا يحب: ${dislikes.join("، ")}`);
      if (conditions.length) constraints.push(`حالات: ${conditions.join("، ")}`);
      // Meds + nausea are per-meal-relevant (timing / temporary aversions), so
      // they repeat in every day prompt; everything else questionnaire-related
      // stays skeleton-only for token economy.
      const medications =
        sm.member_id === "mom" ? context.mom.medications : (ctxMember?.medications ?? []);
      const nauseaFoods =
        sm.member_id === "mom" ? context.mom.nausea_foods : (ctxMember?.nausea_foods ?? []);
      if (medications.length)
        constraints.push(`أدوية: ${medications.join("، ")} (نسّقي توقيت الوجبات؛ لا نصيحة دوائية)`);
      if (nauseaFoods.length)
        constraints.push(`غثيان من: ${nauseaFoods.join("، ")} (تجنّب مؤقت)`);
      const mealMode =
        sm.member_id === "mom" ? context.mom.meal_mode : ctxMember?.meal_mode;
      if (mealMode === "independent")
        constraints.push("وجبات مستقلة (طبق خاص باسم مختلف)");

      const day = sm.days.find((d) => d.day_index === dayIndex);
      const meals = (day?.meals ?? [])
        .map((m) => `${m.slot_name_ar} (${m.slot}): ${m.recipe_name_ar}`)
        .join(" | ");

      const target = isChild
        ? "طفل — بالحصص، بدون هدف سعرات"
        : `الهدف: ${sm.daily_calories_target} سعرة، بروتين ${sm.macros_target.protein_g} / كارب ${sm.macros_target.carbs_g} / دهون ${sm.macros_target.fat_g} (جم)`;

      // No preset dishes for this member today (the skeleton omitted this day, and
      // the family grid is empty during a shared-group regen) → don't print "—",
      // which the model echoes back as an empty `meals` array (DaySlice requires
      // ≥1 → the day fails, and every retry re-rolls the same empty target). Direct
      // a full fresh day that meets the target instead; the prompt lists every
      // member's dishes, so a shared member can still align to a peer that DOES have
      // this day's dishes.
      const mealsLine =
        meals ||
        "لا أطباق محددة لهذا الفرد اليوم — صمّمي له يوماً كاملاً متنوعاً (فطور، غداء، عشاء، وسناك حسب اللزوم) يحقق هدفه، وشاركيه أطباق الآخرين حين تناسبه.";

      return `• member_id="${sm.member_id}" — ${target}${constraints.length ? `؛ ${constraints.join("؛ ")}` : ""}\n  وجبات اليوم: ${mealsLine}`;
    })
    .join("\n");

  const sharedRule = isSolo
    ? "كل وجبة مخصصة لها فقط (لا مشاركة)."
    : "اكتبي لكل فرد وجبته بمقادير **حصته الفردية فقط** (ما يأكله هو وحده)، مع سعراته وماكروزه لحصته. " +
      "حين يناسب نفس الطبق أكثر من فرد، أعطيهم **نفس اسم الطبق ونفس قائمة المكوّنات بالضبط** (نفس الأصناف ونفس الوحدات)، ويختلفون فقط في **كمية** كل مكوّن حسب هدف كل فرد. النظام يجمع حصص المشاركين تلقائياً في وصفة عائلية واحدة بإجمالي الكميات ويحسب التوزيع — لذلك **لا** تكتبي shared_recipe ولا batch_finished_weight_g ولا per_member_portions، و**لا** تضعي الكمية الإجمالية في ingredients (ضعي حصة الفرد فقط). " +
      "شاركي الطبق فقط حين يناسب الجميع فعلاً (لا حساسية متعارضة ولا قيد غذائي/كره قوي ولا اختلاف ماكروز/حالة طبية يمنع ذلك). مَن لا يناسبه الطبق — أو مَن وُسم بـ(وجبات مستقلة) — أعطيه طبقاً مختلفاً **باسم مختلف** لتلك الوجبة. للأطفال: حصة مناسبة للعمر بدون معادلات سعرات.";

  return `# المطلوب (المرحلة 2: توسيع يوم واحد)
وسّعي وجبات **${dayName}** (day_index=${dayIndex}) فقط، لكل فرد، إلى وصفات كاملة تحقق هدف كل فرد. أسماء الأطباق المعطاة لكل فرد هي خطة العائلة لهذا اليوم: التزمي بها **بنفس الاسم تماماً** حين تناسب الفرد (حتى تبقى وجبة عائلية واحدة تُطبخ مرة واحدة وتُقسَّم). أما إذا كان الطبق لا يناسب فرداً فعلاً — حساسية أو حالة طبية أو اختلاف هدف/ماكروز جذري أو طفل/حمل/رضاعة — فأعطيه بدلاً منه طبقاً مناسباً له **باسم مختلف بوضوح** لتلك الوجبة (سيُعامل تلقائياً كوجبة فردية). الأولوية لملاءمة الفرد، لا لتوحيد الطبق. وإن لم تُعطَ أطباق لفردٍ ما (مكتوب: «لا أطباق محددة»)، فصمّمي له يوماً كاملاً مناسباً لهدفه — ولا تتركي وجباته فارغة أبداً.

${sharedRule}

# الأفراد ووجبات هذا اليوم
${memberBlocks}${familyWideText(context)}${feedbackText(context)}

# الإيجاز
- st (خطوات التحضير): 3 خطوات قصيرة كحد أقصى، صيغة أمر مباشرة بلا حشو.
- الحقول الاختيارية (sub، nt): اتركيها فارغة تماماً إلا عند ضرورة حقيقية.
- قائمة مكونات موجزة. "سلطة حرة" → u:"unlimited".
- الكتابة بالعربية فقط، صيغة المؤنث، بدون علامات تعجب.

# الإخراج
أرجعي JSON صالحاً فقط لهذا اليوم. استخدمي **المفاتيح المختصرة التالية بالضبط** (لتصغير الحجم)، ولا تضيفي أي مفاتيح أخرى (لا day_total ولا slot_name_ar — نحسبهما نحن):
\`\`\`ts
type DaySlice = {
  d: number;                               // day_index = ${dayIndex}
  ms: Array<{                              // الأفراد (members)
    id: string;                            // member_id كما هو أعلاه
    m: Array<{                             // وجبات اليوم (meals)
      s: "breakfast"|"lunch"|"dinner"|"snack";   // الوجبة (slot)
      r: string;                           // اسم الطبق
      ig: Array<{ n: string; a: number; mn?: number; mx?: number; u: "g"|"kg"|"ml"|"l"|"tbsp"|"tsp"|"cup"|"piece"|"serving"|"unlimited" }>;  // المكونات: n=الاسم، a=الكمية، mn/mx=نطاق اختياري، u=الوحدة
      st: string[];                        // خطوات التحضير
      sub?: string[];                      // بدائل (اختياري)
      nt?: string;                         // ملاحظات (اختياري)
      c: number;                           // السعرات
      mc: { p: number; cb: number; f: number };  // ماكروز الحصة: p=بروتين، cb=كارب، f=دهون (جم)
    }>;
  }>;
};
\`\`\``;
}
