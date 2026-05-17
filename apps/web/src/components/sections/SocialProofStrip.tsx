"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Star } from "lucide-react";

import { NumberTicker } from "@/components/ui/number-ticker";

interface SocialProofStripProps {
  userCount?: number;
  rating?: number;
  reviewCount?: number;
  pressLogos?: { name: string; logoSrc?: string }[];
}

const DEFAULT_LOGOS: { name: string; logoSrc?: string }[] = [
  { name: "Sayidaty" },
  { name: "Arab News" },
  { name: "ThePlate" },
];

export default function SocialProofStrip({
  userCount = 547,
  rating = 4.8,
  reviewCount = 142,
  pressLogos = DEFAULT_LOGOS,
}: SocialProofStripProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.5, once: true });
  const reduce = useReducedMotion();

  const numberDisplay =
    reduce ? userCount : !inView ? 0 : null;

  return (
    <section
      ref={sectionRef}
      aria-label="إحصائيات وإثبات اجتماعي"
      className="border-y border-ink/10 bg-surface-elevated py-8 md:py-12"
    >
      <div className="container-page grid grid-cols-1 gap-8 text-center md:grid-cols-3 md:gap-12">
        {/* COLUMN 1 — user count */}
        <div className="flex flex-col items-center justify-center gap-2">
          {numberDisplay !== null ? (
            <span className="text-[48px] font-extrabold leading-none tabular-nums tracking-normal text-primary">
              {numberDisplay}
            </span>
          ) : (
            <NumberTicker
              value={userCount}
              className="text-[48px] font-extrabold leading-none tabular-nums tracking-normal text-primary"
            />
          )}
          <span className="text-sm font-medium text-ink-muted">
            عائلة سعودية تستخدم فت لايف
          </span>
        </div>

        {/* COLUMN 2 — rating */}
        <div className="relative flex flex-col items-center justify-center gap-2 md:before:absolute md:before:top-[20%] md:before:start-0 md:before:h-[60%] md:before:w-px md:before:bg-ink/10 md:before:content-['']">
          <div
            className="flex items-center gap-1"
            role="img"
            aria-label={`تقييم ${rating} من 5`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="inline-flex"
                initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                animate={inView ? { opacity: 1, scale: 1 } : undefined}
                transition={{ duration: 0.3, ease: "easeOut" as const, delay: i * 0.08 }}
              >
                <Star
                  className="size-6 fill-brand-yellow text-brand-yellow"
                  aria-hidden="true"
                />
              </motion.span>
            ))}
          </div>
          <span className="text-sm font-medium text-ink-muted">
            {rating} من 5 — تقييم {reviewCount} عائلة
          </span>
        </div>

        {/* COLUMN 3 — press logos */}
        <div className="relative flex flex-col items-center justify-center gap-3 md:before:absolute md:before:top-[20%] md:before:start-0 md:before:h-[60%] md:before:w-px md:before:bg-ink/10 md:before:content-['']">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            كما ظهرنا في
          </span>
          <div className="flex items-center gap-6">
            {pressLogos.map((logo) => (
              <motion.a
                key={logo.name}
                href="#"
                className="inline-flex min-h-11 items-center rounded-md px-2 py-2 text-base font-bold text-ink-muted/60 tracking-[0.05em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                dir="ltr"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={inView ? { opacity: 0.3, y: 0 } : undefined}
                whileHover={!reduce ? { opacity: 1, transition: { duration: 0.2 } } : undefined}
                whileFocus={!reduce ? { opacity: 1, transition: { duration: 0.2 } } : undefined}
                transition={{ duration: 0.4, ease: "easeOut" as const, delay: 0.4 }}
              >
                {logo.name}
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
