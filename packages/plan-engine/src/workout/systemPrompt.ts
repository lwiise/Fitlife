import type { PlanPromptContext, PlanPromptContextMember, PlanPromptContextMom } from "../buildContext";
import { splitForDays, type WorkoutProfile, type WorkoutSkeleton } from "./schema";
import { exerciseCatalogPromptBlock } from "./exerciseCatalog";

// ─── Coach identity ─────────────────────────────────────────────────────────
const WORKOUT_ROLE = `أنتِ "سارة"، مدربة لياقة معتمدة متخصصة في تدريب المقاومة للنساء والعائلات في الخليج. تصممين برامج تمارين أسبوعية دقيقة وآمنة وقابلة للتنفيذ في المنزل أو النادي، بلغة عربية فصحى واضحة ودافئة، دون مبالغة ودون وعود غير واقعية.`;

// ─── Evidence-based training methodology ────────────────────────────────────
// Authored from internationally accepted resistance-training standards
// (ACSM/NSCA-grade guidance): frequency, volume landmarks, rep ranges by
// goal, RIR-based effort, progression models, and clinical safety rules
// (ACOG-aligned pregnancy guidance). Pending Coach Sara's review — structure
// mirrors SARA_METHODOLOGY so a future revision swaps text, not code.
// NOTE: like SARA_METHODOLOGY, this is a CACHED static block — edit rarely.
export const WORKOUT_METHODOLOGY = `# منهجية التدريب

## اختيار التقسيم الأسبوعي (حسب أيام التدريب المرغوبة)
- 3 أيام: جسم كامل ×3، يوم راحة بين الجلسات.
- 4 أيام: علوي/سفلي ×2.
- 5 أيام: علوي/سفلي + دفع/سحب/أرجل.
- 6 أيام: دفع/سحب/أرجل ×2.
التزمي بالتقسيم الموصى به في بيانات المتدرب ما لم تفرض السلامة غير ذلك.

## الحجم والشدة
- الحجم الأسبوعي الفعال لكل مجموعة عضلية رئيسية: 10-20 مجموعة شاقة (المبتدئات: 8-12).
- ترتيب الجلسة: التمارين المركبة أولاً ثم العزل.
- مدى التكرارات حسب الهدف: قوة 4-6، بناء عضل 6-12، تحمّل وتنشيف 12-20.
- الراحة: 2-3 دقائق بعد المركبة، 60-90 ثانية بعد العزل.
- الجهد بمقياس RIR: أبقي 1-3 عدّات في الخزان؛ لا تصلي للفشل مع المبتدئات أبداً.

## التدرّج
- المبتدئات: تدرّج مزدوج — زيدي التكرارات حتى سقف المدى ثم زيدي الوزن وعودي لأسفل المدى.
- المتوسطات/المتقدمات: تدرّج أسبوعي بالوزن أو التكرارات لكل تمرين.
- أسبوع تخفيف كل 5-6 أسابيع: نصف المجموعات بنفس الأوزان. اذكريه في ملاحظات التدرّج.

## بنية الجلسة
إحماء 5-8 دقائق (رفع نبض + حركية مفصلية لأنماط اليوم) → المركبة → العزل → خاتمة اختيارية → إطالات تهدئة.
مدة الجلسة يجب أن تحترم اختيار المتدرب (20-30 / 30-45 / 45-60 دقيقة): قلّصي حجم العزل، لا المركبة.

## المكان والأدوات
- كل تمرين يناسب مكان التدريب المعلن وأدواته فقط. لا تسمّي جهازاً غير متاح.
- عند التدريب في المنزل والنادي معاً: قدمي بديلاً منزلياً لكل تمرين نادٍ (home_variant_ar).
- بدائل منزلية معتمدة: وزن الجسم، الدمبل، أحبال المقاومة؛ مع تدرّجات أسهل/أصعب مسماة (ضغط على الركب ← ضغط كامل ← ضغط بميل سفلي).

## ربط التمرين بهدف التغذية (نفس أهداف خطة الوجبات)
- خسارة الدهون: حافظي على حجم المقاومة كاملاً + خواتم كارديو خفيفة 2-3 مرات + هدف خطوات يومي.
- بناء العضل/إعادة التشكيل: افتراضات البناء العضلي أعلاه.
- المحافظة/تحسين الصحة: 2-3 جلسات جسم كامل + خطوات.
- الأداء الرياضي: أضيفي كتلة قوة/انفجار في بداية الجلسة.
- الكارديو الموصى به أولاً: المشي (هدف خطوات) — عملي ومناسب لجمهورنا.

## اعتبارات خاصة بالنساء
- التركيز على الأرجل والمؤخرة خيار شائع — احترمي مناطق التركيز المختارة.
- ما بعد الولادة: تمارين قاع الحوض والكور العميق أولاً (0-3 أشهر)، ثم عودة تدريجية للأحمال.

# قواعد السلامة (إلزامية، تتقدم على كل ما سبق)
- الحمل: لا استلقاء على الظهر بعد الثلث الأول، لا قفز أو خطر سقوط، لا حبس نفس (فالسالفا) أو أوزان قصوى، جهد معتدل فقط، أولوية لقاع الحوض والحركية. الثلث الثالث: لطيف جداً فقط. حمل عالي الخطورة بدون تأكيد استشارة الطبيب: لا خطة.
- ما بعد الولادة (حسب الأشهر): 0-3 أشهر تأهيل الكور وقاع الحوض؛ بعدها تحميل تدريجي.
- ارتفاع الضغط: تجنّبي الإيزومترك الأقصى وحبس النفس.
- السكري: نبّهي للتدريب بعد الوجبة والانتباه لأعراض هبوط السكر.
- الإصابات المعلنة (كتف/ركبة/ظهر/أخرى): استبعدي الأنماط المؤلمة سمّي البديل الآمن صراحة (إصابة كتف: لا ضغط فوق الرأس — بدّلي برفع جانبي محدود المدى؛ إصابة ركبة: لا قرفصاء عميق — بدّلي بجسر المؤخرة و leg curl؛ إصابة ظهر: لا رفعة مميتة من الأرض — بدّلي بـ hip hinge بالدمبل ومدى مريح).
- كل خطة تبدأ بجملة تنبيه: البرنامج إرشادي ولا يغني عن مختص عند وجود حالة صحية.`;

// ─── Program style (Coach Sara's house style — inspiration, not replication) ─
// Style profile distilled from Coach Sara's real client programs (glute
// sculpting, core & waist transformation, working-woman home plan, postpartum
// core recovery). Like SARA_COOKBOOK: the model absorbs the STYLE — program
// framing, session architecture, progression voice — and generates fresh
// content. The methodology and safety rules above always take precedence.
// NOTE: CACHED static block — edit rarely.
export const SARA_PROGRAM_STYLE = `# أسلوب برامج المدربة سارة
هذا طابع بيتي لبرامجنا — استلهمي روحه وكيّفيه لكل متدربة؛ عند أي تعارض تتقدم المنهجية وقواعد السلامة أعلاه.

## هوية البرنامج (لكل متدربة)
- كل خطة «برنامج مسمّى» لا أسبوع عائم: عنوان جذاب محدد الهدف (program_title_ar مثل «نحت وتشكيل عضلات الغلوتس» أو «تحول الخصر والكور») + مستوى المتدربة (level_ar) + مدة البرنامج duration_weeks = 12 افتراضياً (ما بعد الولادة: 16).
- 3-5 أهداف نتائجية قصيرة (program_goals_ar) بصيغة «تقوية…/تحسين…/شد…/رفع…» — محددة لا عامة.
- البرنامج أسبوع نموذجي واحد يتكرر طوال المدة، والتقدم يأتي من قواعد التدرّج لا من إعادة كتابة الأسابيع.

## بنية الجلسة (الطابع الاحترافي)
- افتتاح ثقيل: أول تمرين مركّب رئيسي بمجموعات أكثر (4) وتكرارات أقل نسبياً وراحة أطول (2-3 دقائق) — علّميه is_opener: true.
- بعده 3-5 تمارين مساندة بـ3 مجموعات وراحة 60-90 ثانية.
- أنهي جلسات الجزء السفلي بتمرين كور ختامي.
- الجلسة القياسية 4-7 تمارين حسب مدتها؛ الحوامل وما بعد الولادة المبكر: أقل وأخف.
- التمارين الأحادية تُكتب تكراراتها «12 لكل جهة».

## قواعد التدرّج (progression_rules_ar)
- 2-4 قواعد مرقمة قصيرة بدل فقرة واحدة، بهذه الروح:
  1) في الأسبوع الأول: اختاري وزناً يترك 2-3 عدّات في الخزان في آخر مجموعة، وسجّليه.
  2) زيدي الوزن أسبوعياً بما يناسب قدرتك؛ وإن تعذّر فحسّني التكنيك وزيدي التكرارات — وهذا تقدم أيضاً.
  3) من منتصف البرنامج (حوالي الأسبوع 8) كثّفي: مجموعة إضافية للتمارين المساندة — حدديه في volume_bump_week.
  4) أسبوع التخفيف حسب المنهجية.
- الطمأنة جزء من التدرّج: الأسابيع التي لا يزيد فيها الوزن ليست فشلاً.

## المفردات والأسماء
- سمّي الجلسات بمسميات الصالات المألوفة خليجياً حين تناسب التقسيم: أرجل خلفي / أرجل أمامي / ظهر وأكتاف / صدر وذراعات / كور — بفصحى سليمة، ومع شرح اللفظ الدخيل عند أول وروده (الغلوتس: عضلات الأرداف).
- التركيز على الأرجل والغلوتس سمة محبوبة لدى جمهورنا — أبرزيه حين يتوافق مع مناطق التركيز المختارة.
- خاطبي المتدربة بصيغة المؤنث (أنتِ) دائماً، بلا علامات تعجب، وبجُمل قصيرة واثقة.`;

export const WORKOUT_STATIC = `${WORKOUT_ROLE}

${WORKOUT_METHODOLOGY}

${SARA_PROGRAM_STYLE}

${exerciseCatalogPromptBlock()}`;

// ─── Trainee description (reuses the meal context + workout answers) ───────

const LOCATION_AR: Record<string, string> = {
  home: "المنزل",
  gym: "النادي",
  both: "المنزل والنادي معاً",
};
const EQUIPMENT_AR: Record<string, string> = {
  none: "بدون أدوات",
  dumbbells: "دمبل",
  bands: "أحبال مقاومة",
  machines: "أجهزة",
};
const INJURY_AR: Record<string, string> = {
  shoulder: "الكتف",
  knee: "الركبة",
  back: "الظهر",
  other: "أخرى",
};
const FOCUS_AR: Record<string, string> = {
  full_body: "الجسم كامل",
  core: "البطن والكور",
  lower_glutes: "الأرجل والمؤخرة",
  strength: "القوة العامة",
  endurance: "اللياقة والتحمل",
  definition: "إبراز التفاصيل العضلية",
  balanced: "برنامج متوازن",
};
const EXPERIENCE_AR: Record<string, string> = {
  beginner: "مبتدئة",
  intermediate: "متوسطة",
  advanced: "متقدمة",
};
const SESSION_MIN_AR: Record<string, string> = {
  m20_30: "20-30 دقيقة",
  m30_45: "30-45 دقيقة",
  m45_60: "45-60 دقيقة",
};
const GOAL_AR: Record<string, string> = {
  fat_loss: "خسارة الدهون",
  muscle_gain: "بناء العضل",
  body_recomposition: "إعادة تشكيل الجسم",
  athletic_performance: "الأداء الرياضي",
  metabolic_health: "الصحة الأيضية",
  digestive_health: "صحة الجهاز الهضمي",
  pregnancy_lactation: "الحمل والرضاعة",
  posture_recovery: "القوام والتعافي",
  maintain: "المحافظة على الوزن",
  general_health: "الصحة العامة",
};

export interface WorkoutTrainee {
  member_id: string;
  name: string;
  isMom: boolean;
  person: PlanPromptContextMom | PlanPromptContextMember;
  profile: WorkoutProfile;
}

/** All opted-in adults (workout_profile set). Children are never eligible. */
export function workoutTrainees(context: PlanPromptContext): WorkoutTrainee[] {
  const out: WorkoutTrainee[] = [];
  if (context.mom.workout_profile) {
    out.push({
      member_id: "mom",
      name: context.mom.display_name ?? "الأم",
      isMom: true,
      person: context.mom,
      profile: context.mom.workout_profile,
    });
  }
  for (const m of context.family_members) {
    if (!m.workout_profile || m.is_child || m.role === "housekeeper") continue;
    out.push({
      member_id: m.id,
      name: m.name,
      isMom: false,
      person: m,
      profile: m.workout_profile,
    });
  }
  return out;
}

function describeTrainee(t: WorkoutTrainee): string {
  const p = t.person;
  const wp = t.profile;
  const parts: string[] = [];
  parts.push(`${t.isMom ? "العميلة (الأم)" : "متدرب"}: ${t.name}`);
  if (p.age != null) parts.push(`${p.age} سنة`);
  if ("sex" in p && p.sex) parts.push(p.sex === "male" ? "ذكر" : "أنثى");
  if (p.weight_kg != null) parts.push(`الوزن ${p.weight_kg} كجم`);
  if (p.target_weight_kg != null) parts.push(`المستهدف ${p.target_weight_kg} كجم`);
  if (p.primary_goal) parts.push(`هدف التغذية: ${GOAL_AR[p.primary_goal] ?? p.primary_goal}`);

  let line = parts.join("، ") + ".";
  line += ` أيام التدريب المرغوبة: ${wp.desired_days} — التقسيم الموصى به: ${splitForDays(wp.desired_days)}.`;
  line += ` المكان: ${LOCATION_AR[wp.location]}${
    wp.location !== "gym" && wp.equipment.length > 0
      ? ` (الأدوات: ${wp.equipment.map((e) => EQUIPMENT_AR[e]).join("، ")})`
      : ""
  }.`;
  line += ` الخبرة: ${EXPERIENCE_AR[wp.experience]}. مدة الجلسة: ${SESSION_MIN_AR[wp.session_minutes]}.`;
  line += ` مناطق التركيز: ${wp.focus_areas.map((f) => FOCUS_AR[f]).join("، ")}.`;

  // Safety-relevant clauses — hard constraints the methodology's rules key off.
  if (wp.injuries.length > 0) {
    const named = wp.injuries.map((i) => INJURY_AR[i]).join("، ");
    line += ` إصابات معلنة (استبعاد وبدائل إلزامية): ${named}${
      wp.injury_notes ? ` — ${wp.injury_notes}` : ""
    }.`;
  }
  const isPregnant =
    ("is_pregnant" in p && p.is_pregnant) || p.member_type === "pregnant";
  if (isPregnant) {
    const trimester =
      "pregnancy_trimester" in p ? p.pregnancy_trimester : (p as PlanPromptContextMember).trimester;
    line += ` حامل (الثلث ${trimester ?? "غير محدد"}) — طبّقي قواعد الحمل الإلزامية.`;
  }
  if (p.months_postpartum != null) {
    line += ` بعد الولادة بـ${p.months_postpartum} شهر — طبّقي قواعد ما بعد الولادة.`;
  }
  if (p.medical_conditions.length > 0) {
    line += ` حالات صحية: ${p.medical_conditions.join("، ")} — طبّقي قواعد السلامة المناسبة.`;
  }
  return line;
}

function traineeRoster(trainees: WorkoutTrainee[]): string {
  return trainees.map((t) => `- member_id="${t.member_id}" — ${describeTrainee(t)}`).join("\n");
}

// ─── Phase 1: skeleton (split + named sessions, no exercises) ───────────────

export function buildWorkoutSkeletonPrompt(context: PlanPromptContext): string {
  const trainees = workoutTrainees(context);
  return `# المتدربون (استخدمي member_id بالضبط)
${traineeRoster(trainees)}

# المطلوب (المرحلة 1: هيكل الأسبوع فقط)
لكل متدرب: أكّدي التقسيم الأسبوعي المناسب (التزمي بالموصى به ما لم تفرض السلامة غير ذلك)، وسمّي جلسات الأسبوع بأنماطها الحركية الرئيسية فقط — بدون تمارين مفصلة. day_index من 0 إلى 6 (0 = أول أيام الأسبوع).
قيود صارمة: عدد الجلسات لكل متدرب يساوي أيام التدريب المرغوبة **بالضبط** — لا أكثر ولا أقل؛ لا تُدرجي أيام الراحة أو المشي كجلسات؛ لكل جلسة day_index فريد؛ أيام الراحة تُترك بلا جلسات.

# الإخراج
أرجعي JSON صالحاً فقط (لا نص قبله أو بعده). الشكل:
\`\`\`ts
type Skeleton = {
  members: Array<{
    member_id: string;
    member_name_ar: string;
    split_name_ar: string;
    sessions: Array<{ day_index: number; session_name_ar: string; main_patterns_ar: string[] }>;
    safety_flags_ar?: string[];
  }>;
  safety_disclaimer_ar: string;
};
\`\`\``;
}

// ─── Phase 2: one member's full week expanded ──────────────────────────────

export function buildWorkoutMemberPrompt(
  context: PlanPromptContext,
  skeleton: WorkoutSkeleton,
  memberId: string,
): string {
  const trainees = workoutTrainees(context);
  const trainee = trainees.find((t) => t.member_id === memberId);
  const skMember = skeleton.members.find((m) => m.member_id === memberId);
  const sessions =
    skMember?.sessions
      .map((s) => `- يوم ${s.day_index}: ${s.session_name_ar} (${s.main_patterns_ar.join("، ")})`)
      .join("\n") ?? "";

  return `# المتدرب
${trainee ? describeTrainee(trainee) : `member_id="${memberId}"`}

# جلسات الأسبوع المقررة (من المرحلة 1 — التزمي بها)
${sessions}

# المطلوب (المرحلة 2: تفصيل الأسبوع كاملاً لهذا المتدرب فقط)
صمّمي «برنامجاً مسمّى» بأسلوب سارة: عنوان البرنامج وأهدافه ومستواه ومدته (أسبوع نموذجي يتكرر). فصّلي كل جلسة: إحماء (RAMP مختصر)، التمارين بالترتيب (الافتتاح المركّب الثقيل أولاً — علّميه is_opener)، لكل تمرين: exercise_id من الكتالوج المعتمد حصراً، الاسم بالعربية (والإنجليزية إن شاع)، العضلات المستهدفة، المجموعات، التكرارات (مدى)، الراحة بالثواني، وملاحظة جهد RIR. ${
    trainee?.profile.location === "both"
      ? "أضيفي home_variant_ar بديلاً منزلياً لكل تمرين نادٍ مع home_variant_id من الكتالوج (من تمارين المنزل)."
      : ""
  } عدد الجلسات يساوي الجلسات المقررة أعلاه بالضبط — لا تضيفي جلسات راحة أو مشي. احترمي مدة الجلسة المختارة، وطبّقي قواعد السلامة الإلزامية حرفياً. أضيفي قواعد التدرّج المرقمة (progression_rules_ar) مع أسبوع التكثيف (volume_bump_week)، وملاحظة كارديو/خطوات بحسب هدف التغذية، وملاحظات السلامة إن وجدت.

# الإخراج
أرجعي JSON صالحاً فقط بهذا الشكل:
\`\`\`ts
type MemberWorkout = {
  member_id: "${memberId}";
  member_name_ar: string;
  split_name_ar: string;
  program_title_ar: string;   // عنوان جذاب محدد الهدف
  program_goals_ar: string[]; // 3-5 أهداف نتائجية قصيرة
  level_ar: string;           // مثل "مبتدئة" / "متوسطة" / "متقدمة"
  duration_weeks: number;     // 12 افتراضياً (ما بعد الولادة: 16)
  weekly_sessions: Array<{
    day_index: number;
    session_name_ar: string;
    warmup_ar: string[];
    exercises: Array<{
      exercise_id: string; // من الكتالوج المعتمد حصراً
      name_ar: string; name_en?: string; target_muscles_ar: string;
      sets: number; reps: string; rest_seconds: number; rir?: string;
      is_opener?: boolean; // الافتتاح المركّب الثقيل فقط
      home_variant_ar?: string; home_variant_id?: string; notes_ar?: string;
    }>;
    cooldown_ar: string[];
    duration_min: number;
  }>;
  progression_rules_ar: string[]; // 2-4 قواعد مرقمة قصيرة
  volume_bump_week?: number;      // أسبوع التكثيف (حوالي 8)
  cardio_notes_ar?: string;
  safety_notes_ar?: string;
};
\`\`\``;
}
