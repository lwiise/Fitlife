"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  ChevronLeft,
  ClipboardList,
  LineChart,
  Users,
  type LucideIcon,
} from "lucide-react";

type Step = {
  num: string;
  Icon: LucideIcon;
  iconClass: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    num: "٠١",
    Icon: ClipboardList,
    iconClass: "text-brand-purple-600",
    title: "جاوبي على 20 سؤال",
    description:
      "عن صحة عائلتك، أهدافك، وأكلكم المفضل. الأسئلة بالعربي، وسهلة.",
  },
  {
    num: "٠٢",
    Icon: Users,
    iconClass: "text-brand-pink",
    title: "استلمي خطة لكل فرد",
    description:
      "خطة للأم، الأب، الأولاد، والخادمة — كل واحد بلغته، وحسب احتياجه الصحي.",
  },
  {
    num: "٠٣",
    Icon: LineChart,
    iconClass: "text-brand-yellow-dark",
    title: "تابعي تقدمك يومياً",
    description:
      "تشات بالعربي يجاوب على أسئلتك، صور قبل/بعد، وقياسات في مكان واحد.",
  },
];

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export default function HowItWorks() {
  const reduce = useReducedMotion();
  const topRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });
  const cardsInView = useInView(cardsRef, { amount: 0.3, once: true });

  const topItem = (delayMs: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: topInView ? { opacity: 1, y: 0 } : undefined,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      delay: delayMs / 1000,
    },
  });

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="relative scroll-mt-24 bg-surface bg-noise py-20 lg:py-28"
    >
      <div className="container-page flex flex-col gap-14 lg:gap-20">
        {/* TOP BLOCK */}
        <div ref={topRef} className="flex flex-col gap-4">
          <motion.span
            className="text-sm font-semibold tracking-wide text-primary"
            {...topItem(0)}
          >
            3 خطوات. مدة الإعداد: دقيقتين.
          </motion.span>
          <motion.h2
            id="how-title"
            className="max-w-[20ch] text-[2rem] font-bold leading-[1.1] tracking-tight text-balance text-foreground lg:text-[2.5rem]"
            {...topItem(100)}
          >
            بسيطة بقدر ما تحتاجين.
          </motion.h2>
        </div>

        {/* CARDS WITH DOTTED LINE */}
        <div ref={cardsRef} className="relative">
          {/* Dotted line — desktop only, behind cards, draws RTL (right→left) */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[8%] top-[24px] -z-10 hidden h-[2px] md:block"
            initial={reduce ? false : { clipPath: "inset(0 0 0 100%)" }}
            animate={
              reduce
                ? undefined
                : cardsInView
                  ? { clipPath: "inset(0 0 0 0)" }
                  : { clipPath: "inset(0 0 0 100%)" }
            }
            transition={{ duration: 1.5, delay: 0.6, ease: "easeInOut" }}
          >
            <svg
              viewBox="0 0 1000 4"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <path
                d="M 4 2 L 996 2"
                stroke="var(--brand-purple-300)"
                strokeWidth="2"
                strokeDasharray="3 6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </motion.div>

          <motion.ul
            variants={listVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12"
          >
            {steps.map(({ num, Icon, iconClass, title, description }) => (
              <motion.li
                key={num}
                variants={cardVariants}
                className="group/step list-none"
              >
                <article className="flex flex-col items-start gap-5">
                  <motion.div
                    variants={itemVariants}
                    className="text-[44px] font-bold leading-none tracking-tight tabular-nums text-brand-pink transition-colors duration-300 group-hover/step:text-brand-pink-dark"
                    aria-hidden="true"
                  >
                    {num}
                  </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/15 bg-surface-elevated"
                  >
                    {/* Corner perforation marks — recipe-card metaphor */}
                    <span
                      aria-hidden="true"
                      className="absolute top-1 start-1 h-1 w-1 rounded-full bg-ink/25"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute top-1 end-1 h-1 w-1 rounded-full bg-ink/25"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 start-1 h-1 w-1 rounded-full bg-ink/25"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 end-1 h-1 w-1 rounded-full bg-ink/25"
                    />

                    <div className="flex h-full w-full items-center justify-center transition-transform duration-300 group-hover/step:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover/step:scale-100">
                      <Icon
                        className={`size-12 ${iconClass}`}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="flex flex-col gap-2"
                  >
                    <h3 className="text-xl font-bold leading-tight text-foreground">
                      {title}
                    </h3>
                    <p className="text-base leading-[1.7] text-ink-muted">
                      {description}
                    </p>
                  </motion.div>
                </article>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* BOTTOM CTA */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={cardsInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.4, ease: "easeOut", delay: 1.2 }}
          className="flex"
        >
          <a
            href="#pricing"
            className="group/cta inline-flex min-h-11 items-center gap-2 py-2 text-base font-bold text-brand-purple-700 transition-colors duration-200 hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            جربيها مجاناً
            <ChevronLeft
              className="size-4 transition-transform duration-200 group-hover/cta:-translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-x-0"
              aria-hidden="true"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
