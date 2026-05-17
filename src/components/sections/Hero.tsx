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

// TODO: Replace 5 placeholder SVG silhouettes with real cutout photography
// (transparent-background PNGs) before launch. Real photos: women/men in Gulf/Filipino
// attire, friendly expressions, similar editorial style to the Clevora reference.

type FamilyMember = {
  label: string;
  sublabel?: string;
  imageSrc: string;
  imageAlt: string;
  bgColor: string;
  textColor: string;
  hasPlayButton?: boolean;
};

// TODO: Pravatar URLs are temporary real-photo placeholders (CC0 portrait service).
// Replace with real brand photography (transparent-background PNG cutouts of
// actual family members or commissioned models) before launch. Drop new files
// at /public/family-{dad,mom,housekeeper,daughter,son}.png and switch imageSrc back.

const familyMembers: FamilyMember[] = [
  {
    label: "خطة للأب",
    sublabel: "اللي على حمية",
    imageSrc: "https://i.pravatar.cc/600?img=12",
    imageAlt: "صورة الأب",
    bgColor: "bg-[#D9B0FC]",
    textColor: "text-[#4E2490]",
  },
  {
    label: "وجبات الأم",
    sublabel: "بسعرات محسوبة",
    imageSrc: "https://i.pravatar.cc/600?img=5",
    imageAlt: "صورة الأم",
    bgColor: "bg-[#C5458F]",
    textColor: "text-white",
  },
  {
    label: "حساب للخادمة",
    sublabel: "بلغتها",
    imageSrc: "https://i.pravatar.cc/600?img=49",
    imageAlt: "صورة الخادمة",
    bgColor: "bg-[#F2BB16]",
    textColor: "text-[#4E2490]",
    hasPlayButton: true,
  },
  {
    label: "للأولاد",
    sublabel: "حسب أعمارهم",
    imageSrc: "https://i.pravatar.cc/600?img=20",
    imageAlt: "صورة البنت",
    bgColor: "bg-[#4E2490]",
    textColor: "text-white",
  },
  {
    label: "كل البيت",
    sublabel: "في خطة واحدة",
    imageSrc: "https://i.pravatar.cc/600?img=33",
    imageAlt: "صورة الولد",
    bgColor: "bg-[#E89B5A]",
    textColor: "text-[#1A1023]",
  },
];

const line1Words = "خطة غذائية".split(" ");
const line2Words = "لكل البيت.".split(" ");
const line3Words = "حتى للخادمة.".split(" ");

const easeOut = "easeOut" as const;

const wordContainer = { hidden: {}, visible: {} };
const wordItem = {
  hidden: { opacity: 0, y: 15 },
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

function DecorativeLeaves({ textColorClass }: { textColorClass: string }) {
  const strokeColor = textColorClass.includes("white") ? "white" : "#4E2490";
  return (
    <svg
      viewBox="0 0 300 200"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="h-full w-full opacity-30"
    >
      <path
        d="M-20 100 Q 50 30, 150 70 T 320 60"
        stroke={strokeColor}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M-10 150 Q 70 90, 160 120 T 310 110"
        stroke={strokeColor}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      <ellipse cx="60" cy="60" rx="14" ry="6" fill={strokeColor} opacity="0.4" transform="rotate(-25 60 60)" />
      <ellipse cx="180" cy="90" rx="18" ry="8" fill={strokeColor} opacity="0.5" transform="rotate(15 180 90)" />
      <ellipse cx="240" cy="50" rx="12" ry="5" fill={strokeColor} opacity="0.4" transform="rotate(-15 240 50)" />
      <ellipse cx="120" cy="130" rx="16" ry="7" fill={strokeColor} opacity="0.4" transform="rotate(25 120 130)" />
      <circle cx="40" cy="120" r="3" fill={strokeColor} opacity="0.5" />
      <circle cx="210" cy="140" r="4" fill={strokeColor} opacity="0.5" />
      <circle cx="280" cy="100" r="3" fill={strokeColor} opacity="0.5" />
    </svg>
  );
}

function FamilyCard({
  member,
  index,
  reduced,
}: {
  member: FamilyMember;
  index: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.5, ease: easeOut, delay: 1.8 + index * 0.08 }
      }
      whileHover={
        reduced
          ? undefined
          : {
              y: -10,
              transition: { duration: 0.3, ease: easeOut },
            }
      }
      className={cn(
        "group relative aspect-[3/4] cursor-default overflow-hidden rounded-3xl shadow-xl",
        member.bgColor,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 overflow-hidden"
      >
        <DecorativeLeaves textColorClass={member.textColor} />
      </div>

      <div className="absolute top-5 start-5 z-20 max-w-[80%]">
        <h3
          className={cn(
            "text-xl font-bold leading-tight md:text-2xl",
            member.textColor,
          )}
        >
          {member.label}
        </h3>
        {member.sublabel && (
          <p
            className={cn(
              "mt-1 text-sm font-medium leading-tight opacity-90 md:text-base",
              member.textColor,
            )}
          >
            {member.sublabel}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 h-[75%]">
        <Image
          src={member.imageSrc}
          alt={member.imageAlt}
          fill
          unoptimized
          sizes="(max-width: 768px) 60vw, 20vw"
          className="object-cover object-top"
        />
      </div>

      {member.hasPlayButton && (
        <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center">
          <button
            type="button"
            onClick={() => track("hero_video_clicked")}
            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg transition-colors hover:bg-[#1A1023] hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlayIcon className="size-4" />
            <span>شغّلي الفيديو</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function MomFloatingCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: -30, y: -20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.6, ease: easeOut, delay: 1.4 }
      }
      className="absolute top-[8%] start-[4%] z-20 hidden w-[260px] -rotate-[3deg] transition-transform duration-300 motion-safe:hover:rotate-0 lg:block"
    >
      <div className="rounded-2xl border border-[#1A1023]/5 bg-white p-4 shadow-xl">
        <div className="flex flex-row items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-pink to-brand-lavender text-sm font-bold text-white">
            ه
          </div>
          <div className="min-w-0 flex-1 text-start">
            <p className="truncate text-sm font-bold text-[#1A1023]">
              هند الدوسري
            </p>
            <p className="text-xs text-[#1A1023]/60">بدأت 27 أكتوبر</p>
          </div>
        </div>
        <div className="mt-3 text-start">
          <p className="mb-1.5 text-xs text-[#1A1023]/60">
            الأسبوع 6، اليوم 5
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1023]/10">
            <div className="h-full w-[70%] rounded-full bg-gradient-to-l from-brand-yellow to-brand-pink" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HousekeeperFloatingCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: 30, y: -20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.6, ease: easeOut, delay: 1.6 }
      }
      className="absolute top-[12%] end-[4%] z-20 hidden w-[260px] rotate-[3deg] transition-transform duration-300 motion-safe:hover:rotate-0 lg:block"
    >
      <div className="rounded-2xl border border-[#1A1023]/5 bg-white p-4 shadow-xl">
        <div className="flex flex-row items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-[#E89B5A] text-sm font-bold text-white">
            R
          </div>
          <div className="min-w-0 flex-1 text-start" dir="ltr">
            <p className="text-sm font-bold text-[#1A1023]">Rosa M.</p>
            <p className="text-xs text-[#1A1023]/60">
              Tagalog · Started Oct 27
            </p>
          </div>
        </div>
        <div className="mt-3 text-start" dir="ltr">
          <p className="mb-1.5 text-xs text-[#1A1023]/60">Week 6, Day 5</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1023]/10">
            <div className="h-full w-[55%] rounded-full bg-gradient-to-r from-brand-yellow to-primary" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SaraPill({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.5, ease: easeOut, delay: 1.8 }
      }
      className="absolute bottom-[5%] start-[5%] z-10 hidden lg:block"
    >
      <div className="inline-flex items-center gap-2.5 rounded-full bg-[#1A1023] px-4 py-2 text-white shadow-lg">
        <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-pink to-brand-lavender text-xs font-bold">
          س
        </div>
        <div className="text-start">
          <p className="text-xs font-bold leading-tight">ساره العتيبي</p>
          <p className="text-[10px] leading-tight text-white/60">
            خبيرة تغذية
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function WaveSVG() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 w-full">
      <svg
        viewBox="0 0 1440 100"
        fill="none"
        preserveAspectRatio="none"
        className="h-[60px] w-full md:h-[100px]"
        aria-hidden="true"
      >
        <path
          d="M0,60 C240,100 480,100 720,60 C960,30 1200,30 1440,60 L1440,100 L0,100 Z"
          fill="var(--color-surface-elevated)"
        />
      </svg>
    </div>
  );
}

export default function Hero() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section
      aria-label="القسم الرئيسي"
      className="relative overflow-hidden pt-32 pb-0"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20"
        style={{
          background: `
            radial-gradient(ellipse 1000px 700px at 15% 25%, rgba(217, 176, 252, 0.55) 0%, transparent 55%),
            radial-gradient(ellipse 800px 900px at 85% 60%, rgba(242, 187, 22, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 600px 600px at 50% 85%, rgba(197, 69, 143, 0.12) 0%, transparent 60%),
            linear-gradient(180deg, #FAFAFA 0%, #EBEFF2 100%)
          `,
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1A1023 1px, transparent 1px),
            linear-gradient(to bottom, #1A1023 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container-page relative pb-32">
        <MomFloatingCard reduced={reduced} />
        <HousekeeperFloatingCard reduced={reduced} />

        <div className="relative mx-auto max-w-5xl pt-12 text-center md:pt-20">
          {reduced ? (
            <h1 className="font-extrabold leading-[0.95] tracking-tight">
              <span className="block text-[clamp(48px,7vw,96px)] text-[#1A1023]">
                خطة غذائية
              </span>
              <span className="mt-2 block text-[clamp(48px,7vw,96px)] text-[#1A1023]">
                لكل البيت.
              </span>
              <span className="mt-2 block text-[clamp(48px,7vw,96px)] text-primary">
                حتى للخادمة.
              </span>
            </h1>
          ) : (
            <motion.h1
              variants={wordContainer}
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.06 }}
              className="font-extrabold leading-[0.95] tracking-tight"
            >
              <motion.span
                variants={wordContainer}
                transition={{ staggerChildren: 0.06, delayChildren: 0.1 }}
                className="block text-[clamp(48px,7vw,96px)] text-[#1A1023]"
              >
                {line1Words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={wordItem}
                    className="me-4 inline-block last:me-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.span>
              <motion.span
                variants={wordContainer}
                transition={{ staggerChildren: 0.06, delayChildren: 0.4 }}
                className="mt-2 block text-[clamp(48px,7vw,96px)] text-[#1A1023]"
              >
                {line2Words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={wordItem}
                    className="me-4 inline-block last:me-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.span>
              <motion.span
                variants={wordContainer}
                transition={{ staggerChildren: 0.06, delayChildren: 0.7 }}
                className="mt-2 block text-[clamp(48px,7vw,96px)] text-primary"
              >
                {line3Words.map((word, i) => (
                  <motion.span
                    key={i}
                    variants={wordItem}
                    className="me-4 inline-block last:me-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.span>
            </motion.h1>
          )}

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.5, ease: easeOut, delay: 1.0 }
            }
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-[#1A1023]/70 md:text-xl"
          >
            ذكاء اصطناعي يصمم خطة لكل فرد في عائلتك بلغته، بإشراف خبيرة تغذية سعودية.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.5, ease: easeOut, delay: 1.2 }
            }
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="#pricing"
              onClick={() => track("hero_cta_clicked")}
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-[#1A1023] px-7 py-3.5 text-base font-bold text-white shadow-lg transition-colors duration-200 hover:bg-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
            >
              <span>ابدئي خطتك المجانية</span>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </a>
            <a
              href="#how-it-works"
              onClick={() =>
                track("secondary_cta_clicked", { section: "hero" })
              }
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full border border-[#1A1023]/10 bg-white px-7 py-3.5 text-base font-bold text-[#1A1023] shadow-md transition-colors duration-200 hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
            >
              <span>شوفي كيف يشتغل</span>
            </a>
          </motion.div>
        </div>

        <SaraPill reduced={reduced} />
      </div>

      <div className="relative">
        <div className="container-page relative z-10 pb-0">
          <div className="hidden md:block">
            <div className="mx-auto grid max-w-6xl grid-cols-5 items-end gap-3 lg:gap-4">
              {familyMembers.map((member, idx) => (
                <div
                  key={idx}
                  className={cn(idx % 2 === 1 ? "md:-translate-y-5" : "")}
                >
                  <FamilyCard
                    member={member}
                    index={idx}
                    reduced={reduced}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="md:hidden">
            <Carousel
              opts={{ align: "start", direction: "rtl", loop: false }}
            >
              <CarouselContent>
                {familyMembers.map((member, idx) => (
                  <CarouselItem key={idx} className="basis-[60%]">
                    <FamilyCard
                      member={member}
                      index={idx}
                      reduced={reduced}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>

        <WaveSVG />
      </div>
    </section>
  );
}
