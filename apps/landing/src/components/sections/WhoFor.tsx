import { CheckCircle2 } from "lucide-react";

import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

const ITEMS = [
  "تبين تبدئين صح من أول مرة بدل التجربة والخطأ",
  "جربتي أنظمة قاسية وما استمريتي، وتبين نظام واقعي يناسب حياتك",
  "تحتاجين متابعة وتشجيع مو بس ملفات تنزلينها وتنسينها",
  "تبين خطة كاملة (تمارين + غذاء + وصفات) بدل شراء كل جزء لحاله",
] as const;

export function WhoFor() {
  return (
    <section aria-labelledby="who-for-title" className="bg-brand-purple-50">
      <div className="container-page py-16 md:py-24">
        <h2 id="who-for-title" className="text-h2 text-brand-purple-900">
          لمن هذه الباقة؟
        </h2>

        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {ITEMS.map((text, i) => (
            <RevealOnScroll key={text} as="li" delayIndex={i}>
              <div className="flex h-full items-start gap-3 rounded-2xl bg-brand-surface-elevated p-5 shadow-sm">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-6 shrink-0 text-brand-purple-600"
                />
                <p className="leading-relaxed font-medium text-brand-ink">
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
