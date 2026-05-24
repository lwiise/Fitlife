"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ChefHat,
  Globe,
  HelpCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react";

type Pain = {
  Icon: LucideIcon;
  iconClass: string;
  text: string;
};

const pains: Pain[] = [
  {
    Icon: ChefHat,
    iconClass: "text-primary",
    text: "تطبخين وجبات مختلفة كل ليلة — وحدة لك، وحدة لزوجك على حمية، وأكل الأولاد. ووقت تطبخها الخدامة، تطلع غير اللي خططتي لها.",
  },
  {
    Icon: Globe,
    iconClass: "text-brand-pink",
    text: "كل تطبيقات التغذية بالإنجليزي. خادمتك من الفلبين، إندونيسيا، أو إثيوبيا — وما تفهم وش لازم تطبخ لك.",
  },
  {
    Icon: Receipt,
    iconClass: "text-brand-yellow-dark",
    text: "تدفعين 200 ريال للجلسة عند اختصاصية. بعد شهرين ترجعين للصفر، وللاختصاصية مرة ثانية.",
  },
  {
    Icon: HelpCircle,
    iconClass: "text-brand-lavender",
    text: "ما تعرفين كم بروتين يحتاج طفلك بعمر 8 سنوات، ولا كم سعرة لازم تأكلين أنتِ بعد الولادة.",
  },
];

export default function Problem() {
  const reduce = useReducedMotion();

  const headerRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLUListElement>(null);
  const headerInView = useInView(headerRef, { amount: 0.3, once: true });
  const cardsInView = useInView(cardsRef, { amount: 0.3, once: true });

  const headerItem = (delayMs: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: headerInView ? { opacity: 1, y: 0 } : undefined,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      delay: delayMs / 1000,
    },
  });

  return (
    <section
      id="problem"
      aria-labelledby="problem-title"
      className="relative scroll-mt-24 bg-surface py-20 lg:py-28"
    >
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
        {/* HEADER — end side (left in RTL), sticky */}
        <motion.header
          ref={headerRef}
          className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:self-start"
        >
          <motion.span
            className="text-sm font-semibold tracking-wider text-primary"
            {...headerItem(0)}
          >
            نعرف بالضبط
          </motion.span>

          <motion.h2
            id="problem-title"
            className="text-[2rem] font-bold leading-[1.1] tracking-tight text-balance text-foreground lg:text-[2.5rem]"
            {...headerItem(100)}
          >
            نعرف يومك يا أم البيت.
          </motion.h2>

          <motion.p
            className="max-w-[36ch] text-lg leading-[1.7] text-ink-muted"
            {...headerItem(250)}
          >
            كل تطبيقات التغذية اللي جربتيها كانت مصممة لعائلة غربية بشخص واحد.
            لكن بيتك مختلف.
          </motion.p>
        </motion.header>

        {/* CARDS — start side (right in RTL) */}
        <motion.ul
          ref={cardsRef}
          className="flex flex-col gap-6 lg:col-span-3 lg:col-start-1 lg:row-start-1"
        >
          {pains.map(({ Icon, text, iconClass }, i) => (
            <motion.li
              key={text}
              className="list-none"
              initial={reduce ? false : { opacity: 0, x: -30 }}
              animate={cardsInView ? { opacity: 1, x: 0 } : undefined}
              transition={{
                duration: 0.5,
                ease: "easeOut" as const,
                delay: i * 0.1,
              }}
              whileHover={
                reduce
                  ? undefined
                  : { scale: 1.005, transition: { duration: 0.2 } }
              }
            >
              <article className="transform-gpu rounded-2xl border border-ink/[0.08] bg-surface-elevated p-7 transition-colors duration-200 ease-out hover:border-brand-pink/30 hover:bg-brand-pink/[0.01]">
                <Icon
                  className={`size-6 ${iconClass}`}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <p className="mt-5 text-base font-medium leading-[1.7] text-balance text-foreground lg:text-[17px]">
                  {text}
                </p>
              </article>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
