import Image from "next/image";
import { ChevronLeft } from "lucide-react";

type Step = {
  num: string;
  title: string;
  description: string;
  image: string;
  alt: string;
};

const steps: Step[] = [
  {
    num: "01",
    title: "نص تجريبي للخطوة الأولى",
    description:
      "وصف تجريبي للخطوة الأولى — نص يشغل سطرين أو ثلاثة لاختبار الارتفاع والمحاذاة في الاتجاه العربي.",
    image: "/step-1.png",
    alt: "صورة تجريبية للخطوة الأولى",
  },
  {
    num: "02",
    title: "نص تجريبي للخطوة الثانية",
    description:
      "وصف تجريبي للخطوة الثانية — نص يشغل سطرين أو ثلاثة لاختبار الارتفاع والمحاذاة في الاتجاه العربي.",
    image: "/step-2.png",
    alt: "صورة تجريبية للخطوة الثانية",
  },
  {
    num: "03",
    title: "نص تجريبي للخطوة الثالثة",
    description:
      "وصف تجريبي للخطوة الثالثة — نص يشغل سطرين أو ثلاثة لاختبار الارتفاع والمحاذاة في الاتجاه العربي.",
    image: "/step-3.png",
    alt: "صورة تجريبية للخطوة الثالثة",
  },
];

function ConnectingLine() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-[8%] -z-0 hidden h-24 w-full text-brand-lavender lg:block"
    >
      <path
        d="M 4 16 C 28 4, 72 4, 96 16"
        stroke="currentColor"
        strokeWidth="0.6"
        fill="none"
        strokeDasharray="1.4 2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="relative scroll-mt-24 bg-surface py-16 lg:py-24"
    >
      <div className="container-page">
        {/* TOP BLOCK — centered */}
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-brand-purple-700">
            نص تجريبي للتسمية
          </span>
          <h2
            id="how-title"
            className="max-w-[24ch] text-balance text-h2 text-foreground"
          >
            نص تجريبي طويل للعنوان الرئيسي للقسم
          </h2>
        </header>

        {/* STEP CARDS GRID */}
        <div className="relative mt-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <ConnectingLine />

          {steps.map(({ num, title, description, image, alt }) => (
            <article key={num} className="relative">
              <span
                aria-hidden="true"
                className="absolute -top-4 -start-4 z-10 text-[64px] font-extrabold leading-none tabular-nums text-brand-pink lg:text-[80px]"
              >
                {num}
              </span>
              <div className="overflow-hidden rounded-2xl shadow-sm">
                <Image
                  src={image}
                  alt={alt}
                  width={640}
                  height={800}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
              <h3 className="mt-6 text-[22px] font-bold text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-base leading-[1.7] text-ink-muted">
                {description}
              </p>
            </article>
          ))}
        </div>

        {/* BOTTOM CTA — centered secondary text button */}
        <div className="mt-16 flex justify-center">
          <a
            href="#problem"
            className="group/cta inline-flex min-h-11 items-center gap-2 py-2 text-base font-semibold text-brand-purple-700 transition-colors duration-200 hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            نص الزر التجريبي الثانوي
            <ChevronLeft
              className="size-4 transition-transform duration-200 group-hover/cta:-translate-x-1 rtl:group-hover/cta:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-x-0"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
