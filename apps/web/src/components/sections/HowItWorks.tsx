"use client";

import { ChevronLeft } from "lucide-react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { useEffect, useRef } from "react";

// TODO: Replace 3 placeholder SVG posters with real product screen recordings
// (MP4 + WebM + poster PNG) before launch. Each video should be 8-15 seconds,
// silent, looping, showing the actual app feature.
//
// Required files in /public/:
//   /public/how-it-works-1.mp4 — 20-question onboarding flow
//   /public/how-it-works-1.webm — same content as WebM (smaller, modern browsers)
//   /public/how-it-works-2.mp4 — multi-member plan generation
//   /public/how-it-works-2.webm
//   /public/how-it-works-3.mp4 — chat + progress tracking
//   /public/how-it-works-3.webm

type Step = {
  number: string;
  title: string;
  description: string;
  videoSrc: string;
  videoSrcWebm?: string;
  posterSrc: string;
  videoAriaLabel: string;
  accentColor: string;
  numberTextColor: string;
};

const steps: Step[] = [
  {
    number: "01",
    title: "جاوبي على 20 سؤال",
    description:
      "عن صحة عائلتك، أهدافك، وأكلكم المفضل. الأسئلة بالعربي، وسهلة.",
    videoSrc: "/how-it-works-1.mp4",
    videoSrcWebm: "/how-it-works-1.webm",
    posterSrc: "/how-it-works-1-poster.svg",
    videoAriaLabel: "عرض مراحل الإعداد: الأسئلة الأولى",
    accentColor: "#4E2490",
    numberTextColor: "#FFFFFF",
  },
  {
    number: "02",
    title: "استلمي خطة لكل فرد",
    description:
      "خطة غذائية لكل فرد من عائلتك حسب احتياجه، وتعليمات الطبخ توصل لمطبخك باللغة اللي تطبخ فيها الخدامة.",
    videoSrc: "/how-it-works-2.mp4",
    videoSrcWebm: "/how-it-works-2.webm",
    posterSrc: "/how-it-works-2-poster.svg",
    videoAriaLabel: "عرض إنشاء خطة لكل فرد في العائلة",
    accentColor: "#C5458F",
    numberTextColor: "#FFFFFF",
  },
  {
    number: "03",
    title: "تابعي تقدمك يومياً",
    description:
      "تشات بالعربي يجاوب على أسئلتك، صور قبل/بعد، وقياسات في مكان واحد.",
    videoSrc: "/how-it-works-3.mp4",
    videoSrcWebm: "/how-it-works-3.webm",
    posterSrc: "/how-it-works-3-poster.svg",
    videoAriaLabel: "عرض متابعة التقدم اليومي",
    accentColor: "#F2BB16",
    numberTextColor: "#1A1023",
  },
];

function StepVideo({ step }: { step: Step }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.4 });
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    if (isInView) {
      video.play().catch(() => {
        // Autoplay blocked or video missing — poster stays visible
      });
    } else {
      video.pause();
    }
  }, [isInView, reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-elevated shadow-md"
      >
        <Image
          src={step.posterSrc}
          alt={`عرض ${step.title}`}
          fill
          unoptimized
          sizes="(max-width: 768px) 90vw, 33vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-elevated shadow-md"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        poster={step.posterSrc}
        aria-label={step.videoAriaLabel}
      >
        {step.videoSrcWebm && (
          <source src={step.videoSrcWebm} type="video/webm" />
        )}
        <source src={step.videoSrc} type="video/mp4" />
      </video>
    </div>
  );
}

function AnimatedTimelineLine({
  lineProgress,
  reducedMotion,
}: {
  lineProgress: ReturnType<typeof useTransform<number, number>>;
  reducedMotion: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-[44px] z-0 hidden h-1 lg:block"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 4"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="2"
          x2="1200"
          y2="2"
          stroke="#1A1023"
          strokeOpacity="0.1"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
      </svg>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 4"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="timeline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4E2490" />
            <stop offset="50%" stopColor="#C5458F" />
            <stop offset="100%" stopColor="#F2BB16" />
          </linearGradient>
        </defs>
        <motion.line
          x1="0"
          y1="2"
          x2="1200"
          y2="2"
          stroke="url(#timeline-gradient)"
          strokeWidth="2.5"
          strokeDasharray="6 8"
          style={{
            pathLength: reducedMotion ? 1 : lineProgress,
          }}
        />
      </svg>
    </div>
  );
}

function StepCard({
  step,
  index,
  reducedMotion,
}: {
  step: Step;
  index: number;
  reducedMotion: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInView = useInView(cardRef, { amount: 0.3, once: true });

  return (
    <motion.div
      ref={cardRef}
      initial={reducedMotion ? false : { opacity: 0, y: 40 }}
      animate={cardInView ? { opacity: 1, y: 0 } : undefined}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 0.5, delay: index * 0.15, ease: "easeOut" as const }
      }
      className="relative"
    >
      <div className="mb-8 flex flex-col items-center">
        <motion.div
          initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
          animate={cardInView ? { scale: 1, opacity: 1 } : undefined}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 0.5,
                  delay: index * 0.15 + 0.2,
                  ease: [0.34, 1.56, 0.64, 1] as const,
                }
          }
          className="relative"
        >
          {!reducedMotion && cardInView && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: step.accentColor, opacity: 0.3 }}
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut" as const,
              }}
            />
          )}
          <span
            className="relative inline-flex h-16 w-16 items-center justify-center rounded-full text-2xl font-extrabold shadow-lg"
            style={{
              backgroundColor: step.accentColor,
              color: step.numberTextColor,
            }}
            aria-hidden="true"
          >
            {step.number}
          </span>
        </motion.div>
      </div>

      <StepVideo step={step} />

      <h3 className="mt-6 text-xl font-bold leading-tight text-foreground md:text-2xl">
        {step.title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-ink-muted">
        {step.description}
      </p>
    </motion.div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const sectionInView = useInView(sectionRef, { amount: 0.2, once: true });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 70%", "end 30%"],
  });
  const lineProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      aria-label="كيف يشتغل التطبيق"
      className="relative scroll-mt-24 bg-surface py-24 md:py-32"
    >
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={sectionInView ? { opacity: 1, y: 0 } : undefined}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.4, ease: "easeOut" as const }
            }
            className="text-sm font-bold text-primary"
          >
            3 خطوات. مدة الإعداد: دقيقتين.
          </motion.span>
          <motion.h2
            initial={reducedMotion ? false : { opacity: 0, y: 15 }}
            animate={sectionInView ? { opacity: 1, y: 0 } : undefined}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.4, ease: "easeOut" as const, delay: 0.1 }
            }
            className="mt-3 text-balance text-[clamp(2rem,4vw,3rem)] font-bold leading-tight text-foreground"
          >
            بسيطة بقدر ما تحتاجين.
          </motion.h2>
        </div>

        <div className="relative mt-16 md:mt-24">
          <AnimatedTimelineLine
            lineProgress={lineProgress}
            reducedMotion={reducedMotion}
          />

          <div className="relative z-10 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-6">
            {steps.map((step, idx) => (
              <StepCard
                key={step.number}
                step={step}
                index={idx}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={sectionInView ? { opacity: 1, y: 0 } : undefined}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.5, ease: "easeOut" as const, delay: 0.8 }
          }
          className="mt-16 flex justify-center md:mt-20"
        >
          <a
            href="#pricing"
            className="group inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-bold text-primary transition-all duration-300 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span>جربيها مجاناً</span>
            <ChevronLeft
              className="size-4 transition-transform group-hover:-translate-x-1 motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
