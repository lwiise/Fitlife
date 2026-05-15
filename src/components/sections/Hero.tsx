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
  "lg:-rotate-[1.1deg]",
  "lg:rotate-[1.3deg]",
  "lg:-rotate-[0.9deg]",
  "lg:rotate-[1.6deg]",
  "lg:-rotate-[1.4deg]",
  "lg:rotate-[0.8deg]",
];

// Tiny perforation marks at card corners — recipe-card metaphor
function PerforationMark({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos = {
    tl: "top-1 start-1",
    tr: "top-1 end-1",
    bl: "bottom-1 start-1",
    br: "bottom-1 end-1",
  }[corner];
  return (
    <span
      aria-hidden="true"
      className={`absolute ${pos} h-1 w-1 rounded-full bg-ink/25`}
    />
  );
}

function PlanCard({ plan, idx }: { plan: Plan; idx: number }) {
  const isLatin = plan.lang !== "ar";
  return (
    <Reveal
      delayMs={500 + idx * 70}
      offset={12}
      className={`${tilts[idx]} transform-gpu`}
    >
      <article className="group/card relative border border-ink/15 bg-surface-elevated px-5 py-4 transition-colors duration-200 hover:border-ink/30">
        <PerforationMark corner="tl" />
        <PerforationMark corner="tr" />
        <PerforationMark corner="bl" />
        <PerforationMark corner="br" />

        <header className="flex items-baseline gap-3 border-b border-ink/10 pb-2">
          <span
            className="text-base font-bold tracking-[0.05em] text-brand-purple-700 tabular-nums"
            aria-hidden="true"
          >
            {plan.num}
          </span>
          <span className="h-px flex-1 bg-ink/20" aria-hidden="true" />
          <span className="text-sm font-bold text-foreground">{plan.who}</span>
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
          className="mt-2 text-start text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted tabular-nums"
        >
          {plan.meta}
        </p>
      </article>
    </Reveal>
  );
}

// Hand-drawn-feel yellow stamp mark under "بلغته"
function HighlightStamp() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 24"
      preserveAspectRatio="none"
      className="absolute inset-x-[-6%] bottom-[2%] -z-0 h-[34%] w-[112%]"
    >
      <path
        d="M3 16 C 40 9, 90 6, 130 11 S 185 22, 197 14 L 196 22 C 150 26, 90 23, 40 22 S 4 22, 3 16 Z"
        fill="var(--brand-yellow)"
        opacity="0.92"
      />
    </svg>
  );
}

// Small Arabic calligraphic flourish under the eyebrow — one accent moment
function Flourish() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 12"
      className="text-brand-pink"
      width="60"
      height="12"
    >
      <path
        d="M2 6 C 10 1, 20 11, 30 6 S 50 1, 58 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="30" cy="6" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section
      id="hero"
      aria-label="القسم الرئيسي"
      className="relative isolate overflow-hidden bg-surface bg-noise py-14 sm:py-20 lg:flex lg:min-h-svh lg:items-center lg:py-12"
    >
      {/* Subtle warm wash — paper-feel — anchored to the start-side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_30%,var(--brand-lavender-soft)_0%,transparent_55%)] opacity-60"
      />

      <div className="container-page relative grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
        {/* HEADLINE COLUMN — start side (right in RTL) */}
        <div className="flex flex-col gap-6 lg:col-span-5 lg:col-start-1">
          <Reveal delayMs={0} className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-purple-700">
              <span
                aria-hidden="true"
                className="inline-block h-px w-10 bg-brand-purple-700"
              />
              للعائلة الخليجية · ٢٠٢٦
            </span>
            <Flourish />
          </Reveal>

          <Reveal
            as="h1"
            delayMs={80}
            className="font-display text-[clamp(3rem,1.8rem+4.5vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-foreground"
          >
            <span className="block">خطة لكل فردٍ</span>
            <span className="block">في البيت،</span>
            <span className="relative inline-block">
              <span className="relative z-10">بلغته</span>
              <HighlightStamp />
            </span>
            <span className="text-foreground/90">.</span>
          </Reveal>

          <Reveal
            as="p"
            delayMs={180}
            className="max-w-[34ch] text-base leading-[1.7] text-ink-muted sm:text-lg"
          >
            ذكاء اصطناعي يصمم خطة وجبات لكلّ فرد في عائلتك، حتى الخادمة — كلٌّ
            بلغته، في أقل من ٣٠ ثانية. مدعوم بخبيرة تغذية سعودية مرخّصة.
          </Reveal>

          <Reveal
            delayMs={280}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7"
          >
            <Button
              size="lg"
              className="h-14 rounded-none px-9 text-base font-bold shadow-none transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--brand-yellow)] active:translate-y-0 active:shadow-[3px_3px_0_0_var(--brand-yellow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              ابدئي خطتكِ المجانية
            </Button>
            <p
              dir="ltr"
              className="text-start text-sm font-medium tracking-wide text-ink-muted tabular-nums"
            >
              +500 عائلة سعودية
              <span aria-hidden="true"> · </span>
              <span dir="rtl">٧ لغات</span>
              <span aria-hidden="true"> · </span>
              <span dir="rtl">٧ أيام مجانًا</span>
            </p>
          </Reveal>

          <Reveal as="p" delayMs={380} className="-mt-1 text-xs text-ink-muted/85">
            بدون بطاقة ائتمان
            <span aria-hidden="true"> · </span>
            إلغاء بضغطة
          </Reveal>
        </div>

        {/* MENU CARD FIELD — end side (left in RTL) */}
        <div className="relative lg:col-span-7 lg:col-start-6">
          <div
            className="mb-6 hidden items-baseline justify-between border-b border-ink/15 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-ink-muted lg:flex"
            aria-hidden="true"
          >
            <span>القائمة · MENU</span>
            <span className="tabular-nums">العدد ٠١ — صباح الجمعة</span>
            <span>٢٠٢٦</span>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6">
            {plans.map((plan, idx) => (
              <li key={plan.num}>
                <PlanCard plan={plan} idx={idx} />
              </li>
            ))}
          </ul>

          <Reveal
            delayMs={1000}
            className="mt-6 hidden items-center gap-3 text-[11px] tracking-[0.14em] text-ink-muted lg:flex"
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
