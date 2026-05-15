"use client";

import Image from "next/image";
import { ChevronLeft, Languages, Shield, Users } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { Button } from "@/components/ui/button";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const textItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const visualItem: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
};

const calloutItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export default function Hero() {
  const reduce = useReducedMotion();

  const reveal = (delayMs: number, variants: Variants = textItem) =>
    reduce
      ? {}
      : {
          initial: "hidden" as const,
          animate: "visible" as const,
          variants,
          transition: {
            duration: 0.4,
            ease: EASE,
            delay: delayMs / 1000,
          },
        };

  return (
    <section
      aria-label="القسم الرئيسي"
      className="relative flex min-h-svh items-center overflow-hidden py-12 lg:h-svh lg:py-16"
    >
      {/* Decorative organic bowl shape — sits behind the text, start-side, above center */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 start-[-8%] -z-10 h-[640px] w-[640px] opacity-40 blur-[100px] lg:-top-32 lg:start-[-4%] lg:h-[780px] lg:w-[780px]"
      >
        <svg
          viewBox="0 0 600 600"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <path
            d="M300 60c92 0 168 38 210 110 32 56 38 124 12 188-30 76-104 134-198 154-92 20-186-4-244-66-52-56-66-138-38-218 24-68 80-122 152-150 36-12 72-18 106-18z"
            fill="var(--brand-lavender)"
          />
        </svg>
      </div>

      <div className="container-page relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-5 lg:gap-12">
        {/* Text content — start side (right in RTL), 60% on desktop */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <motion.span
            className="text-sm font-semibold tracking-wide text-brand-pink"
            {...reveal(0)}
          >
            للعائلة الخليجية
          </motion.span>

          <motion.h1
            className="text-display max-w-[16ch] text-balance text-foreground"
            {...reveal(50)}
          >
            خطة غذائية لكل البيت — حتى الخادمة.
          </motion.h1>

          <motion.p
            className="max-w-[32ch] text-lg leading-[1.7] text-ink-muted lg:text-2xl"
            {...reveal(150)}
          >
            ذكاء اصطناعي يصمم خطة لكل فرد في عائلتك، بلغته، في أقل من 30 ثانية.
            مدعوم بخبيرة تغذية سعودية.
          </motion.p>

          <motion.div
            className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center"
            {...reveal(250)}
          >
            <Button
              size="lg"
              className="group/cta h-14 rounded-xl px-8 text-base font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            >
              ابدئي خطتك المجانية
            </Button>
            <a
              href="#how-it-works"
              className="group/secondary inline-flex items-center gap-2 text-base font-semibold text-brand-purple-700 transition-colors duration-200 hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              شوفي كيف تشتغل
              <ChevronLeft
                className="size-4 transition-transform duration-200 group-hover/secondary:-translate-x-1 rtl:group-hover/secondary:translate-x-1"
                aria-hidden="true"
              />
            </a>
          </motion.div>

          <motion.p className="mt-4 text-sm text-ink-muted" {...reveal(350)}>
            بدون بطاقة ائتمان • تجربة مجانية 7 أيام • إلغاء بضغطة
          </motion.p>

          {/* Trust strip — stacks on mobile, row on desktop */}
          <motion.ul
            className="group/trust mt-8 flex flex-col gap-3 lg:mt-12 lg:flex-row lg:gap-6"
            {...reveal(450)}
          >
            <li className="flex items-center gap-2">
              <Shield
                className="size-4 text-ink-muted transition-colors duration-200 group-hover/trust:text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="text-sm text-ink-muted">
                متوافق مع نظام حماية البيانات السعودي
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Languages
                className="size-4 text-ink-muted transition-colors duration-200 group-hover/trust:text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="text-sm text-ink-muted">يدعم 7 لغات</span>
            </li>
            <li className="flex items-center gap-2">
              <Users
                className="size-4 text-ink-muted transition-colors duration-200 group-hover/trust:text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="text-sm text-ink-muted">+500 عائلة سعودية</span>
            </li>
          </motion.ul>
        </div>

        {/* Visual content — end side (left in RTL), 40% on desktop */}
        <motion.div
          className="lg:col-span-2"
          {...(reduce
            ? {}
            : {
                initial: "hidden",
                animate: "visible",
                variants: visualItem,
                transition: { duration: 0.6, ease: EASE, delay: 0.1 },
              })}
        >
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm rounded-2xl bg-surface-elevated ring-1 ring-ink/5 lg:max-w-none">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-ink-muted">
                Hero Visual
              </span>
              <Image
                src="/hero-dashboard.png"
                alt="لوحة فيت لايف تعرض خططًا غذائية مخصصة لكل فرد في العائلة"
                width={640}
                height={800}
                priority
                sizes="(max-width: 1024px) 24rem, 40vw"
                className="relative h-full w-full object-cover"
              />
            </div>

            {/* Annotation callouts — positioned over the visual */}
            <motion.div
              className="absolute top-[8%] end-[-8%] z-10 flex items-center gap-2 sm:end-[-12%]"
              {...(reduce
                ? {}
                : {
                    initial: "hidden",
                    animate: "visible",
                    variants: calloutItem,
                    transition: { duration: 0.35, ease: EASE, delay: 0.85 },
                  })}
            >
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-purple-700 shadow-md ring-1 ring-ink/5">
                خطة الأم
              </span>
              <span
                aria-hidden="true"
                className="h-px w-8 bg-brand-purple-300"
              />
            </motion.div>

            <motion.div
              className="absolute top-[44%] start-[-10%] z-10 flex items-center gap-2 sm:start-[-14%]"
              {...(reduce
                ? {}
                : {
                    initial: "hidden",
                    animate: "visible",
                    variants: calloutItem,
                    transition: { duration: 0.35, ease: EASE, delay: 1.05 },
                  })}
            >
              <span
                aria-hidden="true"
                className="h-px w-8 bg-brand-purple-300"
              />
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-purple-700 shadow-md ring-1 ring-ink/5">
                خطة الأطفال
              </span>
            </motion.div>

            <motion.div
              className="absolute bottom-[10%] end-[-6%] z-10 flex items-center gap-2 sm:end-[-10%]"
              {...(reduce
                ? {}
                : {
                    initial: "hidden",
                    animate: "visible",
                    variants: calloutItem,
                    transition: { duration: 0.35, ease: EASE, delay: 1.25 },
                  })}
            >
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-purple-700 shadow-md ring-1 ring-ink/5">
                خطة الخادمة
              </span>
              <span
                aria-hidden="true"
                className="h-px w-8 bg-brand-purple-300"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
