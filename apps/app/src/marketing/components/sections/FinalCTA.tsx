"use client";

import { Check, ChevronLeft } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { track } from "@/marketing/lib/analytics";

const headlineWords = "ابدئي رحلة عائلتك الغذائية اليوم.".split(" ");

const reassuranceItems = [
  "بدون بطاقة",
  "إلغاء أي وقت",
  "استرداد 14 يوم",
];

const overshootEase = [0.34, 1.56, 0.64, 1] as const;

export default function FinalCTA() {
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, { amount: 0.3, once: true });

  const headlineContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const wordVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" as const },
    },
  };

  const reassuranceContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        delay: 2,
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const reassuranceItem = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, ease: overshootEase },
    },
  };

  return (
    <section
      ref={sectionRef}
      aria-label="ابدئي رحلتك الغذائية"
      className="relative overflow-hidden bg-primary py-24 lg:py-[120px]"
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 600"
        fill="none"
        aria-hidden="true"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={
          reduced
            ? undefined
            : { duration: 60, ease: "linear" as const, repeat: Infinity }
        }
        className="pointer-events-none absolute bottom-[-100px] end-[-150px] w-[300px] text-brand-yellow opacity-10 md:w-[600px]"
      >
        <path
          d="M300 50 C 450 80, 550 250, 500 400 C 450 520, 280 580, 150 500 C 50 430, 30 280, 100 180 C 160 90, 240 60, 300 50 Z"
          fill="currentColor"
        />
        <path
          d="M300 50 C 250 200, 200 350, 300 500 M150 200 C 200 280, 280 320, 400 300"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          opacity="0.4"
        />
      </motion.svg>

      <div className="container-page relative z-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <motion.span
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={
              reduced || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.4, ease: "easeOut" as const }
            }
            className="text-sm font-bold text-brand-yellow"
          >
            جاهزة تبدئين؟
          </motion.span>

          {reduced ? (
            <h2 className="max-w-[18ch] text-balance text-[clamp(2.5rem,5vw,3.5rem)] font-extrabold leading-[1.1] text-white">
              ابدئي رحلة عائلتك الغذائية اليوم.
            </h2>
          ) : (
            <motion.h2
              variants={headlineContainer}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              className="max-w-[18ch] text-balance text-[clamp(2.5rem,5vw,3.5rem)] font-extrabold leading-[1.1] text-white"
            >
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  variants={wordVariant}
                  className="me-2 inline-block last:me-0"
                >
                  {word}
                </motion.span>
              ))}
            </motion.h2>
          )}

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={
              reduced || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.4, ease: "easeOut" as const, delay: 1.1 }
            }
            className="mx-auto max-w-[600px] text-xl leading-[1.7] text-brand-lavender"
          >
            7 أيام مجانية. بدون بطاقة ائتمان. إذا ما عجبكِ، اضغطي زر واحد وانتهى الأمر.
          </motion.p>

          <motion.a
            href="#pricing"
            onClick={() => track("final_cta_clicked")}
            initial={reduced ? false : { opacity: 0, scale: 0.95 }}
            animate={
              reduced || inView
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.95 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.5,
                    ease: overshootEase,
                    delay: 1.5,
                  }
            }
            whileHover={
              reduced
                ? undefined
                : {
                    backgroundColor: "#FFC927",
                    y: -4,
                    boxShadow:
                      "0 25px 50px -12px rgba(242, 187, 22, 0.4)",
                    transition: { duration: 0.2, ease: "easeOut" as const },
                  }
            }
            whileTap={
              reduced ? undefined : { scale: 0.98, transition: { duration: 0.1 } }
            }
            className="mt-2 inline-flex min-h-[60px] items-center gap-3 rounded-xl bg-brand-yellow px-7 py-4 text-lg font-extrabold text-primary shadow-2xl shadow-brand-yellow/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-yellow/40 md:px-10 md:py-5 md:text-xl animate-pulse-ring hover:animate-none motion-reduce:animate-none"
          >
            <span>ابدئي خطتك المجانية</span>
            <ChevronLeft
              className="size-6 shrink-0"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </motion.a>

          <motion.div
            variants={reduced ? undefined : reassuranceContainer}
            initial={reduced ? false : "hidden"}
            animate={reduced || inView ? "visible" : "hidden"}
            className="mt-8 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-8"
          >
            {reassuranceItems.map((label, i) => (
              <motion.span
                key={i}
                variants={reduced ? undefined : reassuranceItem}
                className="flex flex-row items-center gap-2 text-sm font-medium text-brand-yellow/90"
              >
                <Check
                  className="size-4 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </motion.span>
            ))}
          </motion.div>

          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced || inView ? { opacity: 1 } : { opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.4, ease: "easeOut" as const, delay: 2.5 }
            }
            className="mt-12 text-center text-[13px] font-medium tracking-[0.02em] text-brand-lavender/80"
          >
            نقبل: مدى • Apple Pay • Visa • Mastercard • تابي • تمارا
          </motion.p>
        </div>
      </div>
    </section>
  );
}
