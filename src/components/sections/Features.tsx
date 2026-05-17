"use client";

import {
  Camera,
  ChefHat,
  Languages,
  MessageCircleHeart,
  Sparkles,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

type Card = {
  area: "card1" | "card2" | "card3" | "card4" | "card5" | "card6";
  areaClass: string;
  Icon: LucideIcon;
  iconBgClass: string;
  iconHoverBgClass: string;
  iconColorClass: string;
  title: string;
  description: string;
  large?: boolean;
  decoration?: "weight" | "watch";
};

const cards: Card[] = [
  {
    area: "card1",
    areaClass: "md:[grid-area:card1]",
    Icon: Sparkles,
    iconBgClass: "bg-brand-yellow/15",
    iconHoverBgClass: "group-hover/card:bg-brand-yellow/20",
    iconColorClass: "text-brand-yellow-dark",
    title: "خطط تتعدل تلقائياً مع تغير وزنك",
    description:
      "كل ما تنزلين كيلو، الخطة تعدل السعرات. ما تحتاجين تعيدين الإعداد من الصفر.",
    large: true,
    decoration: "weight",
  },
  {
    area: "card2",
    areaClass: "md:[grid-area:card2]",
    Icon: Languages,
    iconBgClass: "bg-primary/10",
    iconHoverBgClass: "group-hover/card:bg-primary/15",
    iconColorClass: "text-primary",
    title: "بلغة الخادمة، بلغة أولادك",
    description: "7 لغات. كل واحد بلغته. ما يحتاج ترجمة، ما يحتاج تخمين.",
  },
  {
    area: "card3",
    areaClass: "md:[grid-area:card3]",
    Icon: MessageCircleHeart,
    iconBgClass: "bg-brand-pink/10",
    iconHoverBgClass: "group-hover/card:bg-brand-pink/15",
    iconColorClass: "text-brand-pink",
    title: "اسألي أي سؤال — 24/7",
    description: "بالعربي. مدعوم بذكاء اصطناعي متخصص في تغذية الخليج.",
  },
  {
    area: "card4",
    areaClass: "md:[grid-area:card4]",
    Icon: Camera,
    iconBgClass: "bg-brand-lavender/40",
    iconHoverBgClass: "group-hover/card:bg-brand-lavender/50",
    iconColorClass: "text-primary",
    title: "صور قبل/بعد، قياسات، وزن",
    description: "كل تقدمك في مكان واحد، مشفّر، وآمن.",
  },
  {
    area: "card5",
    areaClass: "md:[grid-area:card5]",
    Icon: ChefHat,
    iconBgClass: "bg-brand-yellow/15",
    iconHoverBgClass: "group-hover/card:bg-brand-yellow/20",
    iconColorClass: "text-brand-yellow-dark",
    title: "وصفات خليجية حقيقية",
    description: "كبسة صحية، مندي بسعرات، مقلوبة. مو وصفات مترجمة من الإنترنت.",
  },
  {
    area: "card6",
    areaClass: "md:[grid-area:card6]",
    Icon: Watch,
    iconBgClass: "bg-primary/10",
    iconHoverBgClass: "group-hover/card:bg-primary/15",
    iconColorClass: "text-primary",
    title: "يتصل بساعتك تلقائياً",
    description:
      "Apple Watch، Fitbit، Google Fit — كلها تتزامن. ما تحتاجين تدخلين شي يدوي.",
    large: true,
    decoration: "watch",
  },
];

function WeightTrendDecoration({
  inView,
  reduced,
}: {
  inView: boolean;
  reduced: boolean;
}) {
  const pathLength = 200;
  return (
    <svg
      width="120"
      height="60"
      viewBox="0 0 120 60"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-4 end-4 opacity-30"
    >
      <motion.path
        d="M4 12 C 30 14, 50 28, 70 38 S 100 52, 116 50"
        fill="none"
        stroke="#F2BB16"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={pathLength}
        initial={{ strokeDashoffset: reduced ? 0 : pathLength }}
        animate={{
          strokeDashoffset: reduced || inView ? 0 : pathLength,
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      <circle cx="4" cy="12" r="3" fill="#F2BB16" />
      <circle cx="70" cy="38" r="3" fill="#F2BB16" />
      <circle cx="116" cy="50" r="3" fill="#F2BB16" />
    </svg>
  );
}

function WatchDecoration({
  sectionInView,
  reduced,
}: {
  sectionInView: boolean;
  reduced: boolean;
}) {
  const spinning = sectionInView && !reduced;
  return (
    <svg
      width="80"
      height="120"
      viewBox="0 0 80 120"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 end-6 hidden -translate-y-1/2 opacity-20 md:block"
    >
      <path
        d="M28 8 L52 8 L48 28 L32 28 Z"
        fill="none"
        stroke="#4E2490"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x="20"
        y="28"
        width="40"
        height="56"
        rx="10"
        fill="none"
        stroke="#4E2490"
        strokeWidth="2"
      />
      <path
        d="M32 84 L48 84 L52 104 L28 104 Z"
        fill="none"
        stroke="#4E2490"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x="62"
        y="48"
        width="4"
        height="10"
        rx="1"
        fill="none"
        stroke="#4E2490"
        strokeWidth="2"
      />
      <motion.g
        style={{ transformOrigin: "40px 56px" }}
        animate={spinning ? { rotate: 360 } : undefined}
        transition={
          spinning ? { duration: 8, repeat: Infinity, ease: "linear" } : undefined
        }
      >
        <path
          d="M36 56 A 4 4 0 1 1 44 56"
          fill="none"
          stroke="#4E2490"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M44 56 L42 54 M44 56 L42 58"
          fill="none"
          stroke="#4E2490"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  );
}

function FeatureCard({
  card,
  index,
  sectionInView,
  reduced,
}: {
  card: Card;
  index: number;
  sectionInView: boolean;
  reduced: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const {
    areaClass,
    Icon,
    iconBgClass,
    iconHoverBgClass,
    iconColorClass,
    title,
    description,
    large,
    decoration,
  } = card;

  return (
    <motion.article
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={
        reduced || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
      }
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: reduced ? 0 : index * 0.06,
      }}
      whileHover={
        reduced
          ? undefined
          : {
              scale: 1.005,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      className={`group/card relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-ink/[0.08] bg-surface-elevated shadow-sm transition-[border-color,box-shadow] duration-200 ease-out hover:border-brand-purple-300 hover:shadow-lg ${large ? "p-8" : "p-6"} ${areaClass}`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${iconBgClass} ${iconHoverBgClass}`}
      >
        <Icon
          className={`size-6 ${iconColorClass}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <h3
        className={`relative z-10 font-bold leading-tight text-foreground ${large ? "text-[22px]" : "text-xl"}`}
      >
        {title}
      </h3>
      <p className="relative z-10 max-w-[42ch] text-base leading-[1.7] text-ink-muted">
        {description}
      </p>
      {decoration === "weight" && (
        <WeightTrendDecoration inView={inView} reduced={reduced} />
      )}
      {decoration === "watch" && (
        <WatchDecoration sectionInView={sectionInView} reduced={reduced} />
      )}
    </motion.article>
  );
}

export default function Features() {
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement | null>(null);
  const sectionInView = useInView(sectionRef, { amount: 0.1 });
  const topRef = useRef<HTMLDivElement | null>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });

  return (
    <section
      id="features"
      ref={sectionRef}
      aria-labelledby="features-title"
      className="relative bg-surface py-16 lg:py-24"
    >
      <div className="container-page flex flex-col items-center">
        <header
          ref={topRef}
          className="flex max-w-[600px] flex-col items-center gap-3 text-center"
        >
          <motion.span
            initial={reduced ? false : { opacity: 0, y: 15 }}
            animate={
              reduced || topInView
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 15 }
            }
            transition={{ duration: 0.4, ease: "easeOut", delay: 0 }}
            className="text-sm font-semibold text-primary"
          >
            ميزات تخدمك أنتِ
          </motion.span>
          <motion.h2
            id="features-title"
            initial={reduced ? false : { opacity: 0, y: 15 }}
            animate={
              reduced || topInView
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 15 }
            }
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            صُمم للعائلة الخليجية — بكل تفاصيلها.
          </motion.h2>
        </header>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 md:[grid-template-areas:'card1_card1'_'card2_card3'_'card4_card5'_'card6_card6'] lg:grid-cols-3 lg:gap-6 lg:[grid-template-areas:'card1_card1_card2'_'card3_card4_card5'_'card6_card6_card6']">
          {cards.map((card, i) => (
            <FeatureCard
              key={card.area}
              card={card}
              index={i}
              sectionInView={sectionInView}
              reduced={reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
