"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ChefHat,
  Globe,
  HelpCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react";

type Pain = { Icon: LucideIcon; text: string };

const pains: Pain[] = [
  {
    Icon: ChefHat,
    text: "تطبخين 4 وجبات مختلفة كل ليلة. واحدة لك، وحدة لزوجك الحمية، ثالثة للأولاد، ورابعة للخادمة.",
  },
  {
    Icon: Globe,
    text: "كل تطبيقات التغذية بالإنجليزي. خادمتك من الفلبين، إندونيسيا، أو إثيوبيا — وما تفهم وش لازم تطبخ لك.",
  },
  {
    Icon: Receipt,
    text: "تدفعين 200 ريال للجلسة عند اختصاصية. بعد شهرين ترجعين للصفر، وللاختصاصية مرة ثانية.",
  },
  {
    Icon: HelpCircle,
    text: "ما تعرفين كم بروتين يحتاج طفلك بعمر 8 سنوات، ولا كم سعرة لازم تأكل أنتِ بعد الولادة.",
  },
];

export default function Problem() {
  const reduce = useReducedMotion();

  const titleMotion = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.5, ease: "easeOut" as const },
      };

  return (
    <section
      aria-labelledby="problem-title"
      className="relative bg-gradient-to-b from-surface to-brand-pink/5 py-20 lg:py-28"
    >
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
        {/* Title — visually on the end side (left in RTL), sticky on desktop */}
        <motion.header
          {...titleMotion}
          className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:self-start"
        >
          <span className="text-sm font-semibold text-primary">نعرف بالضبط</span>
          <h2
            id="problem-title"
            className="text-h2 text-balance text-foreground"
          >
            أعراف يومك يا أم البيت.
          </h2>
          <p className="text-lg leading-loose text-ink-muted">
            كل تطبيقات التغذية اللي جربتيها كانت مصممة لعائلة غربية بشخص واحد.
            لكن بيتك مختلف.
          </p>
        </motion.header>

        {/* Pain cards — visually on the start side (right in RTL) */}
        <ul className="flex flex-col gap-6 lg:col-span-3 lg:col-start-1 lg:row-start-1">
          {pains.map(({ Icon, text }, i) => {
            const cardMotion = reduce
              ? {}
              : {
                  initial: { opacity: 0, x: 30 },
                  whileInView: { opacity: 1, x: 0 },
                  viewport: { once: true, margin: "-80px" },
                  transition: {
                    duration: 0.5,
                    delay: i * 0.1,
                    ease: "easeOut" as const,
                  },
                };
            return (
              <motion.li key={i} {...cardMotion} className="list-none">
                <article className="rounded-2xl border border-ink/10 bg-surface-elevated p-7 transition-[transform,border-color] duration-200 ease-out hover:scale-[1.01] hover:border-brand-pink/30">
                  <Icon
                    className="size-6 text-primary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <p className="mt-5 text-lg leading-relaxed text-balance text-foreground">
                    {text}
                  </p>
                </article>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
