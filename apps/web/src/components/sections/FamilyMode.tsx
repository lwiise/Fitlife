"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ChevronLeftIcon } from "lucide-react";

import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Spotlight } from "@/components/ui/spotlight";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

type FamilyMember = {
  src: string;
  name: string;
  language: string;
  goal: string;
  alt: string;
};

const family: FamilyMember[] = [
  {
    src: "/avatar-mom.svg",
    name: "الأم",
    language: "بالعربي",
    goal: "صحة عامة",
    alt: "صورة شخصية للأم",
  },
  {
    src: "/avatar-dad.svg",
    name: "الأب",
    language: "بالعربي",
    goal: "خسارة وزن",
    alt: "صورة شخصية للأب",
  },
  {
    src: "/avatar-kid1.svg",
    name: "أحمد، 10 سنوات",
    language: "بالعربي",
    goal: "نمو متوازن",
    alt: "صورة شخصية لأحمد",
  },
  {
    src: "/avatar-kid2.svg",
    name: "ليلى، 6 سنوات",
    language: "بالعربي",
    goal: "نمو متوازن",
    alt: "صورة شخصية لليلى",
  },
  {
    src: "/avatar-housekeeper.svg",
    name: "روزا",
    language: "بالتاغالوغ",
    goal: "تطبخ للعائلة",
    alt: "صورة شخصية لروزا",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};
const fadeOnly = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};
const fadeScale = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};
const avatarRise = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 },
};

function ProfileCard({ member }: { member: FamilyMember }) {
  return (
    <CardContainer containerClassName="py-0 w-full" className="w-full md:w-auto">
      <CardBody className="group/card relative h-auto w-full md:w-[180px] rounded-2xl border border-white/15 bg-white/[0.08] p-6 md:p-5 backdrop-blur-sm transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-white/[0.12]">
        <CardItem
          translateZ={40}
          className="mx-auto block size-28 md:size-20 overflow-hidden rounded-full ring-1 ring-white/10"
        >
          <Image
            src={member.src}
            alt={member.alt}
            width={112}
            height={112}
            className="size-28 md:size-20 rounded-full object-cover"
            loading="lazy"
          />
        </CardItem>
        <CardItem
          translateZ={20}
          as="p"
          className="mt-4 md:mt-3 block text-center text-lg md:text-base font-bold text-white"
        >
          {member.name}
        </CardItem>
        <CardItem
          translateZ={15}
          as="p"
          className="mt-1 block text-center text-sm md:text-[13px] font-medium text-brand-lavender"
        >
          {member.language}
        </CardItem>
        <CardItem
          translateZ={25}
          as="span"
          className="mt-4 md:mt-3 mx-auto inline-flex items-center justify-center rounded-full border border-brand-yellow/40 bg-[#3A1A6E] px-3 py-1.5 md:px-2.5 md:py-1 text-sm md:text-xs font-semibold text-brand-yellow"
        >
          {member.goal}
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}

export default function FamilyMode() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const avatarRef0 = useRef<HTMLDivElement>(null);
  const avatarRef1 = useRef<HTMLDivElement>(null);
  const avatarRef2 = useRef<HTMLDivElement>(null);
  const avatarRef3 = useRef<HTMLDivElement>(null);
  const avatarRef4 = useRef<HTMLDivElement>(null);
  const avatarRefs = [avatarRef0, avatarRef1, avatarRef2, avatarRef3, avatarRef4];

  const inView = useInView(sectionRef, { amount: 0.3, once: true });
  const shouldReduceMotion = useReducedMotion();
  const animate = inView || shouldReduceMotion;
  const target = animate ? "show" : "hidden";

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const showBeams = isDesktop && !shouldReduceMotion && inView;

  return (
    <section
      ref={sectionRef}
      aria-label="ميزة وضع العائلة"
      className="relative isolate overflow-hidden bg-[#4E2490] py-20 md:py-[120px]"
    >
      <Spotlight
        className="-top-32 start-1/2 -translate-x-1/2"
        fill="#F2BB16"
      />
      <div
        aria-hidden="true"
        className="bg-noise pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
      />

      <div className="container-page relative">
        <header className="mx-auto max-w-[700px] text-center">
          <motion.p
            variants={fadeOnly}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.4, ease: "easeOut" as const }}
            className="text-sm font-bold text-brand-yellow"
          >
            ما أحد يقدمها غيرنا
          </motion.p>
          <motion.h2
            variants={fadeUp}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.4, ease: "easeOut" as const, delay: 0.1 }}
            className="mx-auto mt-4 max-w-[18ch] text-[clamp(2rem,1.5rem+2.5vw,3rem)] font-extrabold leading-[1.1] text-white"
          >
            حساب واحد. خطط لكل البيت.
          </motion.h2>
          <motion.p
            variants={fadeOnly}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.4, ease: "easeOut" as const, delay: 0.25 }}
            className="mx-auto mt-5 max-w-[600px] text-lg leading-[1.7] text-brand-lavender"
          >
            أنتِ تشتركين مرة، وكل فرد من عائلتك يحصل على خطته الخاصة. نبدأ بخطتك،
            بعدها تضيفين عائلتك واحد واحد. وتعليمات الطبخ توصل لمطبخك باللغة اللي
            تطبخ فيها الخدامة.
          </motion.p>
        </header>

        <div ref={containerRef} className="relative mt-14 md:mt-20">
          <motion.div
            variants={fadeScale}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.5, ease: "easeOut" as const, delay: 0.4 }}
            className="relative mx-auto mb-12 flex w-fit items-center justify-center md:mb-16"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-yellow/15 blur-2xl"
            />
            <div
              ref={hubRef}
              className="relative rounded-full border border-brand-yellow/30 bg-white/[0.05] px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md"
            >
              حساب واحد
            </div>
          </motion.div>

          <div className="hidden justify-center gap-4 lg:flex">
            {family.map((m, i) => (
              <motion.div
                key={m.src}
                ref={avatarRefs[i]}
                variants={avatarRise}
                initial={shouldReduceMotion ? false : "hidden"}
                animate={target}
                transition={{
                  duration: 0.5,
                  ease: "easeOut" as const,
                  delay: 0.5 + i * 0.08,
                }}
              >
                <ProfileCard member={m} />
              </motion.div>
            ))}
          </div>

          <div className="lg:hidden">
            <Carousel opts={{ align: "start", direction: "rtl" }}>
              <CarouselContent>
                {family.map((m, i) => (
                  <CarouselItem
                    key={m.src}
                    className="basis-[85%] sm:basis-[55%] md:basis-[40%] lg:basis-[33%]"
                  >
                    <motion.div
                      variants={avatarRise}
                      initial={shouldReduceMotion ? false : "hidden"}
                      animate={target}
                      transition={{
                        duration: 0.5,
                        ease: "easeOut" as const,
                        delay: 0.5 + i * 0.08,
                      }}
                      className="flex w-full justify-center"
                    >
                      <ProfileCard member={m} />
                    </motion.div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          {showBeams && (
            <>
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={hubRef}
                toRef={avatarRef0}
                curvature={36}
                delay={0.8}
                duration={3}
                pathColor="#F2BB16"
                pathOpacity={0.18}
                pathWidth={2}
                gradientStartColor="#F2BB16"
                gradientStopColor="#FFC927"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={hubRef}
                toRef={avatarRef1}
                curvature={36}
                delay={1}
                duration={3}
                pathColor="#F2BB16"
                pathOpacity={0.18}
                pathWidth={2}
                gradientStartColor="#F2BB16"
                gradientStopColor="#FFC927"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={hubRef}
                toRef={avatarRef2}
                curvature={0}
                delay={1.2}
                duration={3}
                pathColor="#F2BB16"
                pathOpacity={0.18}
                pathWidth={2}
                gradientStartColor="#F2BB16"
                gradientStopColor="#FFC927"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={hubRef}
                toRef={avatarRef3}
                curvature={36}
                delay={1.4}
                duration={3}
                pathColor="#F2BB16"
                pathOpacity={0.18}
                pathWidth={2}
                gradientStartColor="#F2BB16"
                gradientStopColor="#FFC927"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={hubRef}
                toRef={avatarRef4}
                curvature={36}
                delay={1.6}
                duration={3}
                pathColor="#F2BB16"
                pathOpacity={0.18}
                pathWidth={2}
                gradientStartColor="#F2BB16"
                gradientStopColor="#FFC927"
              />
            </>
          )}
        </div>

        <motion.figure
          variants={fadeOnly}
          initial={shouldReduceMotion ? false : "hidden"}
          animate={target}
          transition={{ duration: 0.6, ease: "easeOut" as const, delay: 1.4 }}
          className="mx-auto mt-16 max-w-[700px] text-center"
        >
          <motion.svg
            viewBox="0 0 56 40"
            width="56"
            height="40"
            aria-hidden="true"
            focusable="false"
            className="mx-auto block"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
            animate={
              animate
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.7 }
            }
            transition={{ duration: 0.6, ease: "easeOut" as const, delay: 1.4 }}
          >
            <path
              d="M10 18 Q 4 12 8 6 Q 14 2 22 6 Q 26 12 22 20 L 18 34 L 10 34 Z"
              fill="#F2BB16"
            />
            <path
              d="M36 18 Q 30 12 34 6 Q 40 2 48 6 Q 52 12 48 20 L 44 34 L 36 34 Z"
              fill="#F2BB16"
            />
          </motion.svg>
          <motion.blockquote
            variants={fadeOnly}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.6, ease: "easeOut" as const, delay: 2 }}
            className="mt-4 text-[clamp(1.125rem,0.95rem+0.8vw,1.375rem)] italic leading-[1.6] text-white"
          >
            أول مرة روزا تفهم الوصفات بلغتها. الحين كل وجبة تطلع زي ما خططت لها،
            بدون ما أشرح لها كل يوم.
          </motion.blockquote>
          <motion.figcaption
            variants={fadeOnly}
            initial={shouldReduceMotion ? false : "hidden"}
            animate={target}
            transition={{ duration: 0.6, ease: "easeOut" as const, delay: 2.1 }}
            className="mt-4 text-sm font-medium text-brand-lavender"
          >
            — هند، الرياض
          </motion.figcaption>
        </motion.figure>

        <div className="mt-12 flex justify-center">
          <motion.div
            className="inline-block rounded-xl"
            animate={
              shouldReduceMotion
                ? undefined
                : inView
                  ? {
                      boxShadow: [
                        "0 0 0 0 rgba(242,187,22,0.55)",
                        "0 0 0 18px rgba(242,187,22,0)",
                      ],
                    }
                  : undefined
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeOut" as const,
                  }
            }
            whileHover={
              shouldReduceMotion
                ? undefined
                : { boxShadow: "0 14px 44px rgba(242,187,22,0.45)" }
            }
          >
            <a
              href="#pricing"
              onClick={() => track("family_cta_clicked")}
              className={cn(
                "inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-yellow px-9 py-4 text-base font-extrabold text-brand-purple-600 shadow-2xl",
                "hover:-translate-y-0.5 hover:bg-[oklch(0.86_0.17_86)] hover:text-brand-purple-900",
                "transition-[background-color,transform,box-shadow] duration-200",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-yellow/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple-700",
              )}
            >
              اشتركي بباقة العائلة
              <ChevronLeftIcon className="rtl:rotate-180" aria-hidden="true" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
