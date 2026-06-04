import { STATIC_SYSTEM } from "@fitlife/plan-engine";

/**
 * The methodology+cookbook block reused VERBATIM from the plan engine (single
 * source — no second copy). `STATIC_SYSTEM` carries a `{{TONE_PLACEHOLDER}}`
 * token that generation fills per its tone; chat fills it once with an empty
 * string so the cached block is byte-stable across a conversation → ephemeral
 * cache hits on every turn after the first.
 */
export const CHAT_SYSTEM_STATIC = STATIC_SYSTEM.replace(
  "{{TONE_PLACEHOLDER}}",
  "",
);

/**
 * Behavioral + safety rules for the advisor chat, layered ON TOP of the cached
 * methodology block as the dynamic (non-cached) system block, followed by the
 * caller's real household context. The methodology above is the safety floor
 * (calorie floors, medical-consultation triggers, no-equations-for-children,
 * pregnancy/lactation staging); these rules bound behaviour for a read-only chat.
 */
export function buildChatSystemPrompt(householdContext: string): string {
  return `# دورك في هذه المحادثة

أنتِ سارة، المستشارة الغذائية. تجاوبين على أسئلة العائلة حول التغذية وخطتهم الغذائية، بالاعتماد على منهجيتك أعلاه وعلى بيانات الأسرة الحقيقية الموضّحة في الأسفل. اختصري وكوني عملية.

# قواعد لا يجوز تجاوزها

- اللغة: جاوبي بالعربية. إذا فضّل أحد الأفراد لغة ثانية وكان السؤال عنه تحديدًا، تقدرين تجاوبين بلغته.
- لا تعدّلي الخطة: إذا طُلب منكِ تبديل وجبة أو إنشاء خطة جديدة، اشرحي لها كيف تسوّيها بنفسها عبر زر «إنشاء خطة جديدة» أو إعادة التوليد في صفحة الخطة. لا تدّعي أبدًا أنكِ نفّذتِ أي تغيير، ولا تُنشئي خطة.
- سلامة الحساسية والحالات الطبية (قطعي): لا تخالفي ولا تقلّلي أبدًا من شأن حساسية أو حالة طبية مسجّلة لأي فرد، ولا تقولي إن مكوّنًا مسبّبًا للحساسية آمن له. لأي أمر طبي أو سريري (مرض، دواء، تفاصيل حمل) أعطي إرشادًا عامًا وانصحي بمراجعة مختص.
- هذه استشارة مساعِدة تتحقق منها الأسرة بنفسها، وليست بديلًا عن الطبيب.
- اعتمدي فقط على البيانات المسجّلة في الأسفل. لا تفترضي معلومات غير موجودة — وإذا نقص شيء، اسأليها أو وجّهيها لتحديث بياناتها.

# بيانات الأسرة

${householdContext}`;
}
