import { Flame, Gauge, Route } from "lucide-react";

import { RevealOnScroll } from "@/marketing/components/motion/RevealOnScroll";
import { Badge } from "@/marketing/bundle/ui/badge";
import { CONFIG } from "@/marketing/bundle/config";

const PAID_ITEMS = [
  {
    title: "الاستشارة + المتابعة الجماعية",
    value: "قيمتها 700 ر.س",
    description:
      "جلسة استشارية لفهم حالتك وهدفك، ومتابعة جماعية مستمرة تضمن التزامك وتجاوب على أسئلتك أولاً بأول.",
  },
  {
    title: "برنامج تمارين مناسب لك",
    value: "قيمته 300 ر.س",
    description:
      "تختارين البرنامج الأنسب لمستواك وهدفك من برامج التمارين الحالية — سواء كان هدفك شد الجسم، خسارة الوزن، أو بناء لياقتك من الصفر.",
  },
  {
    title: "جدول غذائي حسب سعراتك",
    value: "قيمته 350 – 450 ر.س",
    description:
      "جدول مبني على احتياجك الفعلي من السعرات (من 1800 إلى 2900 سعرة)، بأكل واقعي يناسب سفرتنا — بدون حرمان وبدون تعقيد.",
  },
  {
    title: "ملف كنز الوصفات الصحية",
    value: "قيمته 200 ر.س",
    description:
      "أكثر من 100 وصفة صحية بمقاديرها وقيمها الغذائية، عشان الالتزام يصير لذيذ مو عقوبة.",
  },
] as const;

const FREE_ITEMS = [
  {
    icon: Route,
    title: "رحلة اللياقة",
    description: "دليلك خطوة بخطوة من أول يوم حتى تثبيت النتائج.",
  },
  {
    icon: Flame,
    title: "ملف التسخين والإطالة",
    description:
      "تمارين الإحماء والإطالة الصحيحة لحماية جسمك قبل وبعد كل تمرين.",
  },
  {
    icon: Gauge,
    title: "اختبار اللياقة",
    description: "قيّمي مستواك الحالي وقيسي تقدمك بأرقام واضحة.",
  },
] as const;

// Editorial ledger, not a card grid: numbered rows with hairline separators,
// title + description, and the original value as the row's gold counterweight.
export function ValueStack() {
  return (
    <section aria-labelledby="value-stack-title">
      <div className="container-page py-20 md:py-28">
        <p
          aria-hidden
          className="text-gold-700 flex items-center gap-3 text-sm font-extrabold tabular-nums"
        >
          01
          <span className="bg-gold-700/40 h-px w-10" />
        </p>
        <h2
          id="value-stack-title"
          className="text-offer-h2 mt-3 text-brand-purple-900"
        >
          وش راح يوصلك بالضبط؟
        </h2>

        <ol className="mt-12 border-t border-brand-ink/10">
          {PAID_ITEMS.map((item, i) => (
            <RevealOnScroll key={item.title} as="li" delayIndex={i}>
              <div className="grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-4 border-b border-brand-ink/10 py-8 sm:grid-cols-[auto_1fr_auto] md:gap-x-8 md:py-10">
                <span
                  aria-hidden
                  className="mt-0.5 text-3xl leading-none font-extrabold text-brand-purple-200 tabular-nums select-none md:text-5xl"
                >
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-brand-ink md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 max-w-2xl leading-[1.7] text-brand-ink-muted">
                    {item.description}
                  </p>
                </div>
                <Badge
                  variant="gold"
                  className="col-start-2 justify-self-start text-sm sm:col-start-auto sm:mt-1 sm:justify-self-auto"
                >
                  {item.value}
                </Badge>
              </div>
            </RevealOnScroll>
          ))}
        </ol>

        {/* Free gifts — deliberately breaks the ledger rhythm. */}
        <RevealOnScroll className="mt-10">
          <div className="rounded-2xl border-2 border-dashed border-brand-lavender bg-brand-purple-50 p-6 md:p-9">
            <h3 className="text-xl font-extrabold text-brand-purple-900 md:text-2xl">
              هداياك المجانية 🎁
            </h3>
            <ul className="mt-7 grid gap-7 md:grid-cols-3">
              {FREE_ITEMS.map((item) => (
                <li key={item.title} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-surface-elevated text-brand-purple-700 shadow-sm">
                      <item.icon aria-hidden className="size-5" />
                    </span>
                    <p className="font-bold text-brand-ink">{item.title}</p>
                    <Badge variant="soft" className="ms-auto">
                      مجاناً
                    </Badge>
                  </div>
                  <p className="text-sm leading-[1.7] text-brand-ink-muted">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </RevealOnScroll>
      </div>

      {/* Closing strip — full-bleed purple ledger total, gold hairline edges. */}
      <div className="bg-noise border-gold-500/25 border-y bg-brand-purple-900">
        <div className="container-page flex flex-col items-start gap-8 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <p className="max-w-2xl text-lg leading-[1.7] text-white md:text-xl">
            المجموع لو اشتريتيها منفصلة:{" "}
            <s className="font-bold text-white/60">
              أكثر من{" "}
              <span className="tabular-nums">
                {CONFIG.originalValue.toLocaleString("en-US")}
              </span>{" "}
              ر.س
            </s>{" "}
            — سعرها اليوم ضمن الباقة:{" "}
            <strong className="text-gold-500 text-4xl font-extrabold whitespace-nowrap md:text-5xl">
              <span className="tabular-nums">{CONFIG.bundlePrice}</span> ر.س
            </strong>{" "}
            فقط بعملية شراء واحدة.
          </p>
          {/* Inverse CTA — light focus ring because it sits on purple-900. */}
          <a
            href={CONFIG.sallaCheckoutUrl}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand-surface-elevated px-7 text-base font-bold text-brand-purple-900 transition-colors hover:bg-brand-surface-elevated/90 focus-visible:outline-white"
          >
            احجزي باقتك الآن
          </a>
        </div>
      </div>
    </section>
  );
}
