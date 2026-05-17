"use client";

import { ChevronLeft } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// TODO: Replace family portrait placeholder SVGs with real photography before launch.

type CardVariant = "lavender" | "dark" | "yellow";

type FamilyCard = {
  title: string;
  imageSrc: string;
  alt: string;
  variant: CardVariant;
  hasLeaves: boolean;
  hasVideo?: boolean;
};

const cards: FamilyCard[] = [
  {
    title: "خطة للأب اللي على حمية",
    imageSrc: "/family-dad.svg",
    alt: "صورة الأب — أحمد",
    variant: "lavender",
    hasLeaves: true,
  },
  {
    title: "وجبات الأم بسعرات محسوبة",
    imageSrc: "/family-mom.svg",
    alt: "صورة الأم — هند",
    variant: "dark",
    hasLeaves: false,
  },
  {
    title: "حساب للخادمة بلغتها",
    imageSrc: "/family-housekeeper.svg",
    alt: "صورة الخادمة — روزا",
    variant: "yellow",
    hasLeaves: true,
    hasVideo: true,
  },
  {
    title: "للأولاد حسب أعمارهم",
    imageSrc: "/family-daughter.svg",
    alt: "صورة البنت — ليلى",
    variant: "dark",
    hasLeaves: false,
  },
  {
    title: "كل البيت في خطة واحدة",
    imageSrc: "/family-son.svg",
    alt: "صورة الولد — أحمد الابن",
    variant: "lavender",
    hasLeaves: true,
  },
];

const line1Words = "خطة غذائية لكل البيت.".split(" ");
const line2Words = "حتى للخادمة.".split(" ");
const easeOut = "easeOut" as const;
const overshootEase = [0.34, 1.56, 0.64, 1] as const;

const wordContainer = { hidden: {}, visible: {} };
const wordItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOut },
  },
};

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function LeafPattern({ tone }: { tone: "yellow" | "primary" }) {
  return (
    <svg
      viewBox="0 0 300 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-1/2 w-full",
        tone === "yellow" ? "text-brand-yellow" : "text-primary",
      )}
    >
      <path
        d="M -10 60 Q 30 10 90 50 Q 120 80 80 110 Q 30 100 -10 60 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M 60 90 Q 110 20 170 70 Q 200 110 150 130 Q 90 130 60 90 Z"
        fill="currentColor"
        opacity="0.45"
      />
      <path
        d="M 140 100 Q 200 30 260 80 Q 290 120 230 140 Q 170 140 140 100 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M 220 60 Q 270 10 320 60"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.4"
      />
      <path
        d="M 40 130 Q 90 70 160 110"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.4"
      />
    </svg>
  );
}

function DecorativeCurves({ reduced }: { reduced: boolean }) {
  return (
    <>
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 400"
        fill="none"
        aria-hidden="true"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={
          reduced
            ? undefined
            : { duration: 60, ease: "linear" as const, repeat: Infinity }
        }
        className="pointer-events-none absolute top-[-100px] end-[-120px] w-[300px] text-brand-yellow opacity-10 md:w-[440px]"
      >
        <path
          d="M200 20 C 320 60, 380 180, 340 300 C 300 380, 160 400, 80 320 C 20 260, 20 140, 80 80 C 120 40, 160 30, 200 20 Z"
          fill="currentColor"
        />
      </motion.svg>
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 400"
        fill="none"
        aria-hidden="true"
        animate={reduced ? undefined : { rotate: -360 }}
        transition={
          reduced
            ? undefined
            : { duration: 80, ease: "linear" as const, repeat: Infinity }
        }
        className="pointer-events-none absolute bottom-[60px] start-[-140px] w-[260px] text-brand-yellow opacity-[0.08] md:w-[380px]"
      >
        <path
          d="M200 40 C 320 80, 360 200, 320 320 C 280 380, 140 380, 80 300 C 30 240, 40 120, 100 80 C 140 50, 170 40, 200 40 Z"
          fill="currentColor"
        />
      </motion.svg>
    </>
  );
}

function WaveSVG() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 w-full">
      <svg
        viewBox="0 0 1440 120"
        fill="none"
        preserveAspectRatio="none"
        className="h-[60px] w-full md:h-[120px]"
        aria-hidden="true"
      >
        <path
          d="M0,40 C240,100 480,120 720,80 C960,40 1200,0 1440,40 L1440,120 L0,120 Z"
          fill="var(--color-surface-elevated)"
        />
      </svg>
    </div>
  );
}

function PortraitCard({
  card,
  index,
  reduced,
}: {
  card: FamilyCard;
  index: number;
  reduced: boolean;
}) {
  const variantClasses: Record<CardVariant, string> = {
    lavender: "bg-brand-lavender",
    dark: "bg-[#5B2BA8]",
    yellow: "bg-brand-yellow",
  };
  const titleColorClass: Record<CardVariant, string> = {
    lavender: "text-primary",
    dark: "text-white",
    yellow: "text-primary",
  };
  const leafTone = card.variant === "yellow" ? "primary" : "yellow";

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.5, ease: easeOut, delay: 1.4 + index * 0.08 }
      }
      whileHover={
        reduced
          ? undefined
          : {
              scale: 1.02,
              y: card.variant === "yellow" ? -8 : -4,
              transition: { duration: 0.3, ease: easeOut },
            }
      }
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-3xl shadow-xl",
        variantClasses[card.variant],
      )}
    >
      {card.hasLeaves && <LeafPattern tone={leafTone} />}

      <div className="absolute inset-x-5 top-5 z-10">
        <h3
          className={cn(
            "text-base font-bold leading-tight md:text-lg",
            titleColorClass[card.variant],
          )}
        >
          {card.title}
        </h3>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-0 h-3/5">
        <Image
          src={card.imageSrc}
          alt={card.alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 55vw, 230px"
          className="object-cover object-bottom"
        />
      </div>

      {card.hasVideo && (
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => track("hero_video_clicked")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg transition-colors hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlayIcon className="size-3" />
            <span>شوفي الفيديو</span>
          </button>
        </div>
      )}
    </motion.article>
  );
}

export default function Hero() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section
      aria-label="القسم الرئيسي"
      className="relative overflow-hidden bg-primary pt-20 pb-32 md:pt-24 md:pb-40"
    >
      <DecorativeCurves reduced={reduced} />

      <div className="container-page relative z-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {reduced ? (
            <h1 className="max-w-3xl text-balance text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.05] text-white">
              <span className="block">خطة غذائية لكل البيت.</span>
              <span className="block">حتى للخادمة.</span>
            </h1>
          ) : (
            <h1 className="max-w-3xl text-balance text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.05] text-white">
              <motion.span
                variants={wordContainer}
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
                className="block"
              >
                {line1Words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={wordItem}
                    className="me-3 inline-block last:me-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.span>
              <motion.span
                variants={wordContainer}
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: 0.08, delayChildren: 0.85 }}
                className="block"
              >
                {line2Words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={wordItem}
                    className="me-3 inline-block last:me-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.span>
            </h1>
          )}

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.4, ease: easeOut, delay: 1.1 }
            }
            className="mx-auto mt-6 max-w-xl text-base leading-[1.7] text-white/80 md:text-lg"
          >
            ذكاء اصطناعي يصمم خطة لكل فرد في عائلتك، بلغته.
          </motion.p>

          <motion.a
            href="#pricing"
            onClick={() => track("hero_cta_clicked")}
            initial={reduced ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.5, ease: overshootEase, delay: 1.3 }
            }
            whileHover={
              reduced
                ? undefined
                : {
                    y: -2,
                    transition: { duration: 0.2, ease: easeOut },
                  }
            }
            whileTap={
              reduced
                ? undefined
                : { scale: 0.98, transition: { duration: 0.1 } }
            }
            className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-bold text-primary shadow-2xl transition-colors duration-300 hover:bg-brand-yellow focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <span>ابدئي خطتك المجانية</span>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </motion.a>
        </div>

        <div className="relative z-20 mt-12 -mb-16 md:mt-16 md:-mb-20">
          <div className="hidden md:block">
            <div className="mx-auto grid max-w-6xl grid-cols-5 gap-3 px-4 lg:gap-4">
              {cards.map((card, idx) => (
                <PortraitCard
                  key={idx}
                  card={card}
                  index={idx}
                  reduced={reduced}
                />
              ))}
            </div>
          </div>

          <div className="md:hidden">
            <Carousel
              opts={{ align: "start", direction: "rtl", loop: false }}
            >
              <CarouselContent>
                {cards.map((card, idx) => (
                  <CarouselItem key={idx} className="basis-[55%]">
                    <PortraitCard
                      card={card}
                      index={idx}
                      reduced={reduced}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </div>

      <WaveSVG />
    </section>
  );
}
