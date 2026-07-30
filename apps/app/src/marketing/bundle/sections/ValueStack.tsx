import {
  BookOpenText,
  Dumbbell,
  Flame,
  Gauge,
  MessagesSquare,
  Route,
  UtensilsCrossed,
} from "lucide-react";

import { RevealOnScroll } from "@/marketing/components/motion/RevealOnScroll";
import { Badge } from "@/marketing/bundle/ui/badge";
import { Card } from "@/marketing/bundle/ui/card";
import { CONFIG } from "@/marketing/bundle/config";

const PAID_ITEMS = [
  {
    icon: MessagesSquare,
    title: "الاستشارة + المتابعة الجماعية",
    value: "قيمتها 700 ر.س",
    description:
      "جلسة استشارية لفهم حالتك وهدفك، ومتابعة جماعية مستمرة تضمن التزامك وتجاوب على أسئلتك أولاً بأول.",
  },
  {
    icon: Dumbbell,
    title: "برنامج تمارين مناسب لك",
    value: "قيمته 300 ر.س",
    description:
      "تختارين البرنامج الأنسب لمستواك وهدفك من برامج التمارين الحالية — سواء كان هدفك شد الجسم، خسارة الوزن، أو بناء لياقتك من الصفر.",
  },
  {
    icon: UtensilsCrossed,
    title: "جدول غذائي حسب سعراتك",
    value: "قيمته 350 – 450 ر.س",
    description:
      "جدول مبني على احتياجك الفعلي من السعرات (من 1800 إلى 2900 سعرة)، بأكل واقعي يناسب سفرتنا — بدون حرمان وبدون تعقيد.",
  },
  {
    icon: BookOpenText,
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

export function ValueStack() {
  return (
    <section aria-labelledby="value-stack-title">
      <div className="container-page py-16 md:py-24">
        <h2 id="value-stack-title" className="text-h2 text-brand-purple-900">
          وش راح يوصلك بالضبط؟
        </h2>

        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {PAID_ITEMS.map((item, i) => (
            <RevealOnScroll key={item.title} as="li" delayIndex={i}>
              <Card className="h-full gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-purple-100 text-brand-purple-700">
                    <item.icon aria-hidden className="size-6" />
                  </span>
                  <Badge variant="gold" className="text-sm">
                    {item.value}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-h3 text-brand-ink">{item.title}</h3>
                  <p className="mt-2 leading-[1.7] text-brand-ink-muted">
                    {item.description}
                  </p>
                </div>
              </Card>
            </RevealOnScroll>
          ))}
        </ul>

        {/* Free gifts — deliberately breaks the card-grid rhythm. */}
        <RevealOnScroll className="mt-8">
          <div className="rounded-2xl border-2 border-dashed border-brand-lavender bg-brand-purple-50 p-6 md:p-8">
            <h3 className="text-h3 text-brand-purple-900">
              هداياك المجانية 🎁
            </h3>
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
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

      {/* Closing strip — full-bleed purple ledger. */}
      <div className="bg-noise bg-brand-purple-900">
        <div className="container-page flex flex-col items-start gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-14">
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
            <strong className="text-gold-500 text-3xl font-extrabold whitespace-nowrap md:text-4xl">
              <span className="tabular-nums">{CONFIG.bundlePrice}</span> ر.س
            </strong>{" "}
            فقط بعملية شراء واحدة.
          </p>
          {/* Inverse CTA — light focus ring because it sits on purple-900. */}
          <a
            href={CONFIG.sallaCheckoutUrl}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand-surface-elevated px-6 text-base font-bold text-brand-purple-900 transition-colors hover:bg-brand-surface-elevated/90 focus-visible:outline-white"
          >
            احجزي باقتك الآن
          </a>
        </div>
      </div>
    </section>
  );
}
