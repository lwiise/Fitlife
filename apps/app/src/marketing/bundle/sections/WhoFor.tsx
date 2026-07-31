import { CheckCircle2 } from "lucide-react";

import { Reveal } from "@/marketing/bundle/Reveal";
import { SectionEyebrow } from "@/marketing/bundle/ui/section-eyebrow";

const ITEMS = [
  "تبين تبدئين صح من أول مرة بدل التجربة والخطأ",
  "جربتي أنظمة قاسية وما استمريتي، وتبين نظام واقعي يناسب حياتك",
  "تحتاجين متابعة وتشجيع مو بس ملفات تنزلينها وتنسينها",
  "تبين خطة كاملة (تمارين + غذاء + وصفات) بدل شراء كل جزء لحاله",
] as const;

// Editorial two-column read: the heading parks on the start side while the
// list scrolls past it — no cards, just ruled lines and gold marks. Each row's
// hairline draws across as the row arrives, so the list assembles itself.
export function WhoFor() {
  return (
    <section aria-labelledby="who-for-title" className="bg-brand-purple-50">
      <div className="container-page section-shell lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <SectionEyebrow index="02" />
          <h2
            id="who-for-title"
            className="text-offer-h2 mt-4 text-brand-purple-900"
          >
            لمن هذه الباقة؟
          </h2>
        </Reveal>

        <ul className="mt-12 border-t border-brand-ink/10 lg:mt-0">
          {ITEMS.map((text, i) => (
            <Reveal key={text} as="li" delayIndex={i} className="group/row">
              <div className="flex items-start gap-5 py-7 md:gap-6 md:py-9">
                <span className="pop-in bg-gold-500/22 mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-gold-700 ring-1 ring-gold-700/35 transition-transform duration-300 group-hover/row:scale-105">
                  <CheckCircle2 aria-hidden className="size-5" />
                </span>
                <p className="text-lg leading-[1.8] font-medium text-brand-ink md:text-xl">
                  {text}
                </p>
              </div>
              <span
                aria-hidden
                className="rule-grow block h-px bg-brand-ink/10"
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
