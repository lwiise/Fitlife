"use client";

import {
  Heart,
  Sparkles,
  Star,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useRef } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

type Testimonial = {
  name: string;
  city: string;
  photoSrc: string;
  quote: string;
  resultText: string;
  resultIcon: LucideIcon;
  plan: string;
};

const testimonials: Testimonial[] = [
  {
    name: "هند الدوسري",
    city: "الرياض",
    photoSrc: "/testimonial-1.svg",
    quote:
      "كنت أطبخ 4 وجبات كل ليلة. الحين كل البيت يأكل من نفس الخطة، بس كل واحد بكميته. خادمتي عائشة فرحانة لأنها صارت تأكل صحي معانا.",
    resultText: "خسرت 7 كيلو في 3 شهور",
    resultIcon: TrendingDown,
    plan: "باقة العائلة",
  },
  {
    name: "ريم القحطاني",
    city: "جدة",
    photoSrc: "/testimonial-2.svg",
    quote:
      "أم حامل في الشهر السابع. صعب ألقى تطبيق يعرف وش يناسبني الحين. ساره راجعت خطتي بنفسها، وغيرتها مرتين حسب فحوصاتي.",
    resultText: "حمل صحي، وزن ضمن المعدل",
    resultIcon: Heart,
    plan: "باقة البريميوم",
  },
  {
    name: "نوف المطيري",
    city: "الدمام",
    photoSrc: "/testimonial-3.svg",
    quote:
      "كل تطبيق غذاء أحاول استخدمه يكون بالإنجليزي. أولادي بعمر 8 و 11 صاروا يدخلون التطبيق ويختارون أكلهم بنفسهم. هذا أكبر تغيير صار في بيتنا.",
    resultText: "أولادي تعلموا يختارون أكل صحي",
    resultIcon: Sparkles,
    plan: "باقة العائلة",
  },
];

const overshootEase = [0.34, 1.56, 0.64, 1] as const;

function TestimonialCard({
  t,
  index,
  reduced,
}: {
  t: Testimonial;
  index: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const baseDelay = index * 0.12;
  const ResultIcon = t.resultIcon;

  return (
    <motion.article
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 30 }}
      animate={
        reduced || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: 0.5,
              ease: "easeOut" as const,
              delay: baseDelay,
            }
      }
      whileHover={
        reduced
          ? undefined
          : {
              scale: 1.005,
              transition: { duration: 0.2, ease: "easeOut" as const },
            }
      }
      className="group/card relative flex h-full flex-col gap-4 rounded-2xl border border-ink/[0.08] bg-surface-elevated p-6 shadow-sm transition-[border-color,box-shadow] duration-200 ease-out hover:border-ink/20 hover:shadow-lg md:p-8"
    >
      <div className="flex flex-row items-center gap-3">
        <Image
          src={t.photoSrc}
          alt={`${t.name} — ${t.city}`}
          width={56}
          height={56}
          unoptimized
          className="size-14 shrink-0 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <span className="text-base font-bold leading-tight text-ink">
            {t.name}
          </span>
          <span className="mt-0.5 text-sm font-medium text-ink-muted">
            {t.city}
          </span>
        </div>
      </div>

      <div
        className="mt-4 flex flex-row gap-1"
        role="img"
        aria-label="تقييم 5 من 5"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.span
            key={i}
            initial={reduced ? false : { opacity: 0, scale: 0.5 }}
            animate={
              reduced || inView
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.5 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.25,
                    ease: overshootEase,
                    delay: baseDelay + 0.3 + i * 0.05,
                  }
            }
            className="inline-block"
          >
            <Star
              className="size-[18px] fill-brand-yellow text-brand-yellow"
              aria-hidden="true"
            />
          </motion.span>
        ))}
      </div>

      <p className="mt-4 text-base font-medium leading-[1.7] text-ink md:text-[17px]">
        {t.quote}
      </p>

      <motion.span
        initial={reduced ? false : { opacity: 0, scale: 0.85 }}
        animate={
          reduced || inView
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.85 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : {
                duration: 0.4,
                ease: overshootEase,
                delay: baseDelay + 0.95,
              }
        }
        className="mt-auto inline-flex w-fit flex-row items-center gap-2 rounded-full border border-brand-yellow/30 bg-brand-yellow/15 px-3.5 py-2 text-sm font-semibold text-[#B8870B]"
      >
        <ResultIcon
          className="size-4 shrink-0"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span>{t.resultText}</span>
      </motion.span>

      <span className="mt-2 text-xs font-medium text-ink-muted">{t.plan}</span>
    </motion.article>
  );
}

export default function Testimonials() {
  const reduced = useReducedMotion() ?? false;
  const topRef = useRef<HTMLDivElement | null>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });

  const topFade = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 15 },
    animate:
      reduced || topInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.4, ease: "easeOut" as const, delay },
  });

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="relative overflow-hidden bg-surface py-16 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_color-mix(in_oklch,_var(--brand-pink)_3%,_transparent)_0%,_transparent_60%)]"
      />

      <div className="container-page relative">
        <header
          ref={topRef}
          className="mx-auto mb-16 flex max-w-[700px] flex-col items-center gap-3 text-center"
        >
          <motion.span
            {...topFade(0)}
            className="text-sm font-semibold text-brand-pink"
          >
            عائلات حقيقية، نتائج حقيقية
          </motion.span>
          <motion.h2
            id="testimonials-title"
            {...topFade(0.1)}
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            ما يقولون عن فت لايف.
          </motion.h2>
        </header>

        <div className="lg:hidden">
          <Carousel opts={{ align: "start", direction: "rtl" }}>
            <CarouselContent>
              {testimonials.map((t, i) => (
                <CarouselItem
                  key={i}
                  className="basis-[88%] md:basis-1/2"
                >
                  <TestimonialCard t={t} index={i} reduced={reduced} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        <div className="hidden gap-6 lg:grid lg:grid-cols-3 lg:items-stretch">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} t={t} index={i} reduced={reduced} />
          ))}
        </div>
      </div>
    </section>
  );
}
