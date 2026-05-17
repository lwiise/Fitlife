"use client";

import {
  Award,
  BadgeCheck,
  GraduationCap,
  MessageSquare,
  Shield,
  Stethoscope,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { Fragment, useRef } from "react";

type TrustCard = {
  Icon: LucideIcon;
  iconBgClass: string;
  iconHoverBgClass: string;
  iconColorClass: string;
  hoverBorderClass: string;
  title: string;
  description: string;
};

const trustCards: TrustCard[] = [
  {
    Icon: Shield,
    iconBgClass: "bg-emerald-500/[0.12]",
    iconHoverBgClass: "group-hover/card:bg-emerald-500/[0.16]",
    iconColorClass: "text-emerald-600",
    hoverBorderClass: "hover:border-emerald-500/25",
    title: "بياناتك الصحية مشفّرة",
    description: "تشفير AES-256. ما نشاركها مع أي طرف ثالث. أبداً.",
  },
  {
    Icon: BadgeCheck,
    iconBgClass: "bg-primary/[0.12]",
    iconHoverBgClass: "group-hover/card:bg-primary/[0.16]",
    iconColorClass: "text-primary",
    hoverBorderClass: "hover:border-primary/25",
    title: "متوافق مع نظام حماية البيانات السعودي",
    description: "وكذلك GDPR للمعايير الأوروبية.",
  },
  {
    Icon: Trash2,
    iconBgClass: "bg-brand-pink/[0.12]",
    iconHoverBgClass: "group-hover/card:bg-brand-pink/[0.16]",
    iconColorClass: "text-brand-pink",
    hoverBorderClass: "hover:border-brand-pink/25",
    title: "حقك تحذفين كل بياناتك أي وقت",
    description: "بضغطة. بدون اتصالات، بدون أسئلة.",
  },
  {
    Icon: MessageSquare,
    iconBgClass: "bg-brand-yellow/[0.18]",
    iconHoverBgClass: "group-hover/card:bg-brand-yellow/[0.22]",
    iconColorClass: "text-[#B8870B]",
    hoverBorderClass: "hover:border-brand-yellow/25",
    title: "الدعم متاح بالعربي",
    description: "نرد على واتساب خلال ساعة في ساعات العمل.",
  },
];

const credentials: { Icon: LucideIcon; label: string }[] = [
  {
    Icon: GraduationCap,
    label: "ماجستير تغذية إكلينيكية — جامعة الملك سعود",
  },
  { Icon: Award, label: "زمالة الأكاديمية الأمريكية للتغذية" },
  { Icon: Stethoscope, label: "12 سنة في الممارسة" },
];

const compliance = [
  "متوافقة مع SDAIA",
  "GDPR",
  "SSL 256-bit",
  "ISO 27001",
];

const settleEase = [0.16, 1, 0.3, 1] as const;

function TrustMiniCard({
  card,
  index,
  reduced,
}: {
  card: TrustCard;
  index: number;
  reduced: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const {
    Icon,
    iconBgClass,
    iconHoverBgClass,
    iconColorClass,
    hoverBorderClass,
    title,
    description,
  } = card;

  return (
    <motion.article
      ref={ref}
      initial={reduced ? false : { opacity: 0, x: -20 }}
      animate={
        reduced || inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }
      }
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.5, ease: "easeOut", delay: index * 0.1 }
      }
      whileHover={
        reduced
          ? undefined
          : {
              scale: 1.005,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      className={`group/card flex flex-row items-start gap-4 rounded-xl border border-ink/[0.08] bg-surface p-5 transition-colors duration-200 ${hoverBorderClass}`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${iconBgClass} ${iconHoverBgClass}`}
      >
        <Icon
          className={`size-5 ${iconColorClass}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold leading-snug text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-[1.6] text-ink-muted">
          {description}
        </p>
      </div>
    </motion.article>
  );
}

export default function Trust() {
  const reduced = useReducedMotion() ?? false;

  const topRef = useRef<HTMLDivElement | null>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });

  const leftColRef = useRef<HTMLDivElement | null>(null);
  const leftColInView = useInView(leftColRef, { amount: 0.2, once: true });

  const complianceRef = useRef<HTMLDivElement | null>(null);
  const complianceInView = useInView(complianceRef, {
    amount: 0.5,
    once: true,
  });

  const fadeUp = (delay: number, y: number = 15, duration: number = 0.4) => ({
    initial: reduced ? false : { opacity: 0, y },
    animate:
      reduced || leftColInView
        ? { opacity: 1, y: 0 }
        : { opacity: 0, y },
    transition: reduced
      ? { duration: 0 }
      : { duration, ease: "easeOut", delay },
  });

  const topFadeUp = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 15 },
    animate:
      reduced || topInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.4, ease: "easeOut", delay },
  });

  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="relative scroll-mt-24 bg-surface-elevated py-16 lg:py-24"
    >
      <div className="container-page">
        <header
          ref={topRef}
          className="mx-auto mb-16 flex max-w-[700px] flex-col items-center gap-3 text-center"
        >
          <motion.span
            {...topFadeUp(0)}
            className="text-sm font-semibold text-primary"
          >
            نعرف إن الثقة تُكتسب
          </motion.span>
          <motion.h2
            id="trust-title"
            {...topFadeUp(0.1)}
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            خلف فت لايف — أشخاص حقيقيون.
          </motion.h2>
        </header>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10 lg:grid-cols-5 lg:gap-16">
          <div ref={leftColRef} className="md:col-span-7 lg:col-span-3">
            <div className="relative aspect-[3/4] w-full max-w-[480px]">
              <motion.div
                aria-hidden="true"
                initial={
                  reduced ? false : { opacity: 0, x: 30, rotate: 8 }
                }
                animate={
                  reduced || leftColInView
                    ? { opacity: 1, x: 0, rotate: 1.5 }
                    : { opacity: 0, x: 30, rotate: 8 }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.7, ease: settleEase, delay: 0.2 }
                }
                className="absolute top-2 end-2 h-full w-full rounded-2xl bg-brand-yellow/20"
              />
              {/* TODO: Replace /sara-portrait.svg with real photograph of Sara before launch */}
              <motion.div
                initial={
                  reduced
                    ? false
                    : { opacity: 0, scale: 0.96, rotate: -4 }
                }
                animate={
                  reduced || leftColInView
                    ? { opacity: 1, scale: 1, rotate: -1.5 }
                    : { opacity: 0, scale: 0.96, rotate: -4 }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.8, ease: settleEase, delay: 0.5 }
                }
                className="relative h-full w-full rounded-2xl shadow-xl shadow-primary/20"
              >
                <Image
                  src="/sara-portrait.svg"
                  alt="ساره العتيبي — خبيرة التغذية المعتمدة في فت لايف"
                  width={480}
                  height={640}
                  unoptimized
                  className="h-full w-full rounded-2xl object-cover"
                />
              </motion.div>
            </div>

            <div className="mt-12">
              <motion.h3
                {...fadeUp(1.3, 10)}
                className="text-[28px] font-extrabold leading-tight text-ink"
              >
                ساره العتيبي
              </motion.h3>
              <motion.p
                {...fadeUp(1.4, 10)}
                className="mt-1 text-base font-semibold text-primary"
              >
                خبيرة تغذية معتمدة، الهيئة السعودية للتخصصات الصحية
              </motion.p>
              <motion.p
                {...fadeUp(1.5, 10)}
                className="mt-4 max-w-[50ch] text-base leading-[1.7] text-ink-muted"
              >
                12 سنة في تغذية الأسرة الخليجية. شاركت في تطوير كل خطة في فت لايف. هي اللي تختار الوصفات، وهي اللي تراجع كل خطة قبل لا توصلك.
              </motion.p>

              <motion.ul
                {...fadeUp(2.2, 8, 0.5)}
                className="mt-6 flex flex-row flex-wrap gap-x-6 gap-y-3"
              >
                {credentials.map(({ Icon, label }, i) => (
                  <li key={i} className="flex flex-row items-start gap-2">
                    <Icon
                      className="mt-0.5 size-[18px] shrink-0 text-brand-purple-700"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-[13px] font-medium leading-[1.4] text-ink-muted">
                      {label}
                    </span>
                  </li>
                ))}
              </motion.ul>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:col-span-5 lg:col-span-2">
            {trustCards.map((card, i) => (
              <TrustMiniCard
                key={i}
                card={card}
                index={i}
                reduced={reduced}
              />
            ))}
          </div>
        </div>

        <motion.div
          ref={complianceRef}
          initial={reduced ? false : { opacity: 0 }}
          animate={
            reduced || complianceInView ? { opacity: 1 } : { opacity: 0 }
          }
          transition={
            reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }
          }
          className="mt-20 flex flex-row flex-wrap items-center justify-center gap-3 text-[13px] font-medium text-ink-muted"
        >
          {compliance.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && <span aria-hidden="true">•</span>}
              <span>{item}</span>
            </Fragment>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
