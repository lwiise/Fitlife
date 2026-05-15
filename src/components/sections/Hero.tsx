import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

type Plan = {
  num: string;
  who: string;
  dish: string;
  meta: string;
  lang: "ar" | "en" | "tl";
};

const plans: Plan[] = [
  {
    num: "٠١",
    who: "أنتِ",
    dish: "دجاج مشوي مع حمص وخضار مشكّلة",
    meta: "٣٢٠ سعرة · عربي",
    lang: "ar",
  },
  {
    num: "٠٢",
    who: "زوجكِ",
    dish: "Grilled chicken & quinoa, low-carb",
    meta: "480 kcal · English",
    lang: "en",
  },
  {
    num: "٠٣",
    who: "أطفالكِ",
    dish: "أرز بالخضار ودجاج مفروم",
    meta: "٢٨٠ سعرة · عربي",
    lang: "ar",
  },
  {
    num: "٠٤",
    who: "خادمتكِ",
    dish: "Inihaw na manok at gulay, ulam",
    meta: "340 kcal · Tagalog",
    lang: "tl",
  },
  {
    num: "٠٥",
    who: "أمكِ",
    dish: "دجاج بالأرز قليل الملح والدهون",
    meta: "٢٩٠ سعرة · عربي",
    lang: "ar",
  },
  {
    num: "٠٦",
    who: "ضيوفكِ",
    dish: "كبسة دجاج خفيفة لـ ٨ أشخاص",
    meta: "٤١٠ سعرة · عربي",
    lang: "ar",
  },
];

const tilts = [
  "lg:-rotate-[1.2deg] lg:translate-y-2",
  "lg:rotate-[1.5deg] lg:-translate-y-3",
  "lg:-rotate-[1deg] lg:translate-y-3",
  "lg:rotate-[2deg] lg:-translate-y-1",
  "lg:-rotate-[1.5deg] lg:translate-y-1",
  "lg:rotate-[0.8deg] lg:translate-y-4",
];

const indents = ["ms-0", "ms-6", "ms-3", "ms-8", "ms-2", "ms-5"];

function PlanCard({ plan, idx }: { plan: Plan; idx: number }) {
  const isLatin = plan.lang !== "ar";
  return (
    <Reveal
      delayMs={500 + idx * 80}
      offset={14}
      className={`${tilts[idx]} ${indents[idx]} lg:ms-0 transform-gpu`}
    >
      <article className="group/card border border-ink/15 bg-surface-elevated/80 backdrop-blur-[2px] px-5 py-4 transition-colors duration-200 hover:border-ink/30">
        <header className="flex items-baseline gap-3 border-b border-ink/10 pb-2">
          <span
            className="font-display text-base font-semibold tracking-[0.05em] text-brand-purple-700 tabular-nums"
            aria-hidden="true"
          >
            {plan.num}
          </span>
          <span className="h-px flex-1 bg-ink/20" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            {plan.who}
          </span>
        </header>
        <p
          dir={isLatin ? "ltr" : "rtl"}
          lang={plan.lang}
          className={`mt-3 text-[15px] leading-snug text-foreground ${isLatin ? "text-start" : ""}`}
        >
          {plan.dish}
        </p>
        <p
          dir="ltr"
          className="mt-2 text-start text-xs font-medium uppercase tracking-[0.08em] text-ink-muted tabular-nums"
        >
          {plan.meta}
        </p>
      </article>
    </Reveal>
  );
}

export default function Hero() {
  return (
    <section
      id="hero"
      aria-label="القسم الرئيسي"
      className="relative bg-surface bg-noise overflow-hidden py-16 sm:py-20 lg:flex lg:min-h-svh lg:items-center lg:py-12"
    >
      <div className="container-page relative grid w-full grid-cols-1 gap-14 lg:grid-cols-12 lg:items-center lg:gap-12">
        {/* TEXT COLUMN — START side (right in RTL) */}
        <div className="flex flex-col gap-7 lg:col-span-5 lg:col-start-1">
          <Reveal
            as="span"
            delayMs={0}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-purple-700"
          >
            <span
              aria-hidden="true"
              className="inline-block h-px w-8 bg-brand-purple-700"
            />
            للعائلة الخليجية · ٢٠٢٦
          </Reveal>

          <Reveal
            as="h1"
            delayMs={80}
            className="font-display text-[clamp(2.6rem,1.6rem+5vw,5.5rem)] font-bold leading-[1.02] tracking-tight text-foreground"
          >
            <span className="block">خطة لكل فردٍ</span>
            <span className="block">في البيت،</span>
            <span className="relative inline-block">
              <span className="relative z-10">بلغته</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-[-4px] bottom-[8%] -z-0 h-[28%] -skew-y-2 bg-brand-yellow/90"
              />
            </span>
            <span className="text-foreground/90">.</span>
          </Reveal>

          <Reveal as="p" delayMs={180} className="max-w-[34ch] text-lg leading-[1.7] text-ink-muted">
            ذكاء اصطناعي يصمم خطة وجبات لكلّ فرد في عائلتك، حتى الخادمة — كلٌّ
            بلغته، في أقل من ٣٠ ثانية. مدعوم بخبيرة تغذية سعودية مرخّصة.
          </Reveal>

          <Reveal
            delayMs={280}
            className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7"
          >
            <Button
              size="lg"
              className="h-14 rounded-none px-9 text-base font-bold shadow-none transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--brand-yellow)] active:translate-y-0 active:shadow-[3px_3px_0_0_var(--brand-yellow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              ابدئي خطتكِ المجانية
            </Button>
            <p
              dir="ltr"
              className="text-sm font-medium tracking-wide text-ink-muted tabular-nums text-start"
            >
              +500 عائلة سعودية
              <span aria-hidden="true"> · </span>
              <span dir="rtl">٧ لغات</span>
              <span aria-hidden="true"> · </span>
              <span dir="rtl">٧ أيام مجانًا</span>
            </p>
          </Reveal>

          <Reveal as="p" delayMs={380} className="-mt-2 text-xs text-ink-muted/80">
            بدون بطاقة ائتمان
            <span aria-hidden="true"> · </span>
            إلغاء بضغطة
          </Reveal>
        </div>

        {/* CARD FIELD — END side (left in RTL) */}
        <div className="relative lg:col-span-7 lg:col-start-6">
          {/* Magazine masthead row above the cards (desktop only) */}
          <div
            className="mb-6 hidden items-baseline justify-between border-b border-ink/15 pb-2 font-display text-xs uppercase tracking-[0.22em] text-ink-muted lg:flex"
            aria-hidden="true"
          >
            <span>القائمة · MENU</span>
            <span className="tabular-nums">العدد ٠١ — صباح الجمعة</span>
            <span>٢٠٢٦</span>
          </div>

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-7">
            {plans.map((plan, idx) => (
              <li key={plan.num}>
                <PlanCard plan={plan} idx={idx} />
              </li>
            ))}
          </ul>

          <Reveal
            delayMs={1000}
            className="mt-6 hidden items-center gap-3 text-xs tracking-[0.12em] text-ink-muted lg:flex"
          >
            <span
              aria-hidden="true"
              className="inline-block h-px w-12 bg-ink/30"
            />
            <span>تتغيّر القائمة كل يوم · {plans.length} خطط نشطة</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
