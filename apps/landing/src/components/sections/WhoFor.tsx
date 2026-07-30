import { CheckCircle2 } from "lucide-react";

import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

const ITEMS = [
  "تبين تبدئين صح من أول مرة بدل التجربة والخطأ",
  "جربتي أنظمة قاسية وما استمريتي، وتبين نظام واقعي يناسب حياتك",
  "تحتاجين متابعة وتشجيع مو بس ملفات تنزلينها وتنسينها",
  "تبين خطة كاملة (تمارين + غذاء + وصفات) بدل شراء كل جزء لحاله",
] as const;

// Editorial two-column read: sticky heading on the start side, a hairline
// checklist on the end side — no cards.
export function WhoFor() {
  return (
    <section aria-labelledby="who-for-title" className="bg-brand-purple-50">
      <div className="container-page py-20 md:py-28 lg:grid lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p
            aria-hidden
            className="text-gold-700 flex items-center gap-3 text-sm font-extrabold tabular-nums"
          >
            02
            <span className="bg-gold-700/40 h-px w-10" />
          </p>
          <h2
            id="who-for-title"
            className="text-offer-h2 mt-3 text-brand-purple-900"
          >
            لمن هذه الباقة؟
          </h2>
        </div>

        <ul className="mt-10 border-t border-brand-ink/10 lg:mt-0">
          {ITEMS.map((text, i) => (
            <RevealOnScroll key={text} as="li" delayIndex={i}>
              <div className="flex items-start gap-5 border-b border-brand-ink/10 py-7 md:py-8">
                <CheckCircle2
                  aria-hidden
                  className="text-gold-700 mt-1 size-7 shrink-0"
                />
                <p className="text-lg leading-[1.7] font-medium text-brand-ink md:text-xl">
                  {text}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </ul>
      </div>
    </section>
  );
}
