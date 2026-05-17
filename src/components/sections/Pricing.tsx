"use client";

import { Check, Shield, Unlock, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useRef, useState } from "react";

import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Tier = {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
};

const tiers: Tier[] = [
  {
    name: "البداية",
    monthlyPrice: 29,
    annualPrice: 23,
    description: "للشخص الواحد، تبدئين رحلتك",
    features: [
      "خطة غذائية شخصية",
      "5 أسئلة يومياً للمساعد الذكي",
      "تتبع الوزن والقياسات",
      "وصفات خليجية أساسية",
      "بالعربي",
    ],
    cta: "ابدئي البداية",
    highlighted: false,
  },
  {
    name: "المتقدمة",
    monthlyPrice: 59,
    annualPrice: 47,
    description: "للأم، مع تتبع متقدم",
    features: [
      "كل ميزات البداية",
      "محادثات غير محدودة مع الذكاء الاصطناعي",
      "تكامل مع Apple Watch و Fitbit",
      "صور قبل/بعد",
      "تقارير أسبوعية",
    ],
    cta: "اختاري المتقدمة",
    highlighted: false,
  },
  {
    name: "العائلة",
    monthlyPrice: 129,
    annualPrice: 103,
    description: "للبيت كامل — حتى 5 أفراد بما فيهم الخادمة",
    features: [
      "كل ميزات المتقدمة لكل فرد",
      "حتى 5 حسابات في الباقة",
      "حساب منفصل للخادمة بلغتها",
      "خطط للأولاد حسب أعمارهم",
      "تقارير عائلية شهرية",
      "أولوية في الدعم",
    ],
    cta: "اشتركي بباقة العائلة",
    highlighted: true,
    badge: "الأكثر شعبية",
  },
  {
    name: "البريميوم",
    monthlyPrice: 249,
    annualPrice: 199,
    description: "العائلة + جلسات مع خبيرة تغذية",
    features: [
      "كل ميزات العائلة",
      "جلستان شهرياً مع خبيرة تغذية معتمدة",
      "خطط مخصصة لحالات خاصة (حمل، سكري، ضغط)",
      "تقارير صحية يومية",
    ],
    cta: "اختاري البريميوم",
    highlighted: false,
  },
];

const trustItems = [
  { Icon: Shield, label: "ضمان استرداد 14 يوم" },
  { Icon: X, label: "إلغاء أي وقت" },
  { Icon: Unlock, label: "بدون التزام" },
];

const familyGlowKeyframes = [
  "0 25px 50px -12px rgba(242,187,22,0.15), 0 0 0 0 rgba(242,187,22,0.30)",
  "0 25px 50px -12px rgba(242,187,22,0.15), 0 0 0 8px rgba(242,187,22,0.00)",
  "0 25px 50px -12px rgba(242,187,22,0.15), 0 0 0 0 rgba(242,187,22,0.30)",
];

const familyStaticShadow =
  "0 25px 50px -12px rgba(242,187,22,0.15), 0 0 0 0 rgba(242,187,22,0)";

function PricingCard({
  tier,
  index,
  billing,
  reduced,
}: {
  tier: Tier;
  index: number;
  billing: "monthly" | "annual";
  reduced: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  const {
    name,
    monthlyPrice,
    annualPrice,
    description,
    features,
    cta,
    highlighted,
    badge,
  } = tier;

  const displayedPrice = billing === "monthly" ? monthlyPrice : annualPrice;

  const cardBase =
    "relative flex h-full flex-col rounded-2xl p-8 transition-transform duration-200 ease-out";
  const cardSkin = highlighted
    ? "bg-primary border border-white/10 shadow-2xl shadow-brand-yellow/15 z-10 lg:scale-[1.02]"
    : "bg-surface-elevated border border-ink/10 shadow-sm hover:border-primary/30 hover:shadow-md transition-[border-color,box-shadow] duration-200 ease-out";

  const tierLabelClass = highlighted
    ? "text-brand-yellow"
    : "text-brand-purple-700";
  const priceColorClass = highlighted ? "text-white" : "text-ink";
  const periodClass = highlighted ? "text-brand-lavender" : "text-ink-muted";
  const descriptionClass = highlighted
    ? "text-brand-lavender"
    : "text-ink-muted";
  const annualLineClass = highlighted ? "text-brand-lavender" : "text-ink-muted";
  const dividerClass = highlighted ? "bg-white/15" : "bg-ink/10";
  const checkClass = highlighted ? "text-brand-yellow" : "text-emerald-600";
  const featureTextClass = highlighted ? "text-white" : "text-ink";

  const isFamilyGlow = highlighted && !reduced;

  const initial = reduced ? false : { opacity: 0, y: 30 };

  const animate = reduced
    ? undefined
    : inView
      ? {
          opacity: 1,
          y: 0,
          ...(isFamilyGlow ? { boxShadow: familyGlowKeyframes } : {}),
        }
      : { opacity: 0, y: 30 };

  const transition = reduced
    ? undefined
    : {
        opacity: { duration: 0.5, ease: "easeOut" as const, delay: index * 0.1 },
        y: { duration: 0.5, ease: "easeOut" as const, delay: index * 0.1 },
        ...(isFamilyGlow && inView
          ? {
              boxShadow: {
                duration: 4,
                repeat: Infinity,
                ease: "easeOut" as const,
                delay: index * 0.1 + 0.6,
              },
            }
          : {}),
      };

  const whileHover = reduced
    ? undefined
    : highlighted
      ? {
          boxShadow: familyStaticShadow,
          transition: { duration: 0.2, ease: "easeOut" as const },
        }
      : {
          scale: 1.005,
          transition: { duration: 0.2, ease: "easeOut" as const },
        };

  return (
    <motion.article
      ref={ref}
      initial={initial}
      animate={animate}
      transition={transition}
      whileHover={whileHover}
      className={`${cardBase} ${cardSkin}`}
    >
      {badge && (
        <span className="absolute top-0 inset-x-0 mx-auto w-fit -translate-y-1/2 rounded-full bg-brand-yellow px-4 py-1.5 text-xs font-bold uppercase text-primary">
          {badge}
        </span>
      )}

      <span className={`text-sm font-bold uppercase ${tierLabelClass}`}>
        {name}
      </span>

      <div className="mt-4 flex flex-row items-baseline gap-2">
        {reduced ? (
          <span
            className={`text-5xl font-extrabold tabular-nums leading-none ${priceColorClass}`}
          >
            {displayedPrice}
          </span>
        ) : (
          <NumberTicker
            value={displayedPrice}
            startValue={monthlyPrice}
            className={`text-5xl font-extrabold tabular-nums leading-none ${priceColorClass}`}
          />
        )}
        <span className={`text-2xl font-semibold ${priceColorClass}`}>
          ر.س
        </span>
      </div>
      <p className={`mt-1 text-sm font-medium ${periodClass}`}>شهرياً</p>

      <AnimatePresence mode="wait">
        {billing === "annual" && (
          <motion.p
            key="annual-clarifier"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: "easeOut" as const }}
            className={`mt-2 text-xs ${annualLineClass}`}
          >
            تُدفع سنوياً ({annualPrice * 12} ر.س/سنة)
          </motion.p>
        )}
      </AnimatePresence>

      <p className={`mt-3 text-sm leading-[1.5] ${descriptionClass}`}>
        {description}
      </p>

      <div className={`mt-6 h-px ${dividerClass}`} aria-hidden="true" />

      <ul className="mt-6 flex flex-col gap-3">
        {features.map((feature, i) => (
          <li key={i} className="flex flex-row items-start gap-3">
            <Check
              className={`mt-0.5 size-[18px] shrink-0 ${checkClass}`}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <span className={`text-sm leading-[1.5] ${featureTextClass}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-2">
        {highlighted ? (
          <Button
            size="lg"
            className="w-full min-h-11 bg-brand-yellow font-bold text-primary shadow-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand-yellow hover:shadow-lg hover:brightness-110"
          >
            {cta}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="w-full min-h-11 border-primary bg-transparent font-semibold text-primary transition-transform duration-200 ease-out hover:-translate-y-px hover:bg-primary/5"
          >
            {cta}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

export default function Pricing() {
  const reduced = useReducedMotion() ?? false;
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const topRef = useRef<HTMLDivElement | null>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });

  const topInit = reduced ? false : { opacity: 0, y: 15 };
  const topAnimate = (delay: number) =>
    reduced
      ? undefined
      : topInView
        ? { opacity: 1, y: 0 }
        : { opacity: 0, y: 15 };
  const topTransition = (delay: number) =>
    reduced ? undefined : { duration: 0.4, ease: "easeOut" as const, delay };

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="relative scroll-mt-24 overflow-hidden bg-surface py-16 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklch,_var(--brand-lavender)_8%,_transparent)_0%,_transparent_60%)]"
      />

      <div className="container-page relative">
        <header
          ref={topRef}
          className="mx-auto flex max-w-[600px] flex-col items-center gap-3 text-center"
        >
          <motion.span
            initial={topInit}
            animate={topAnimate(0)}
            transition={topTransition(0)}
            className="text-sm font-semibold text-primary"
          >
            الأسعار
          </motion.span>
          <motion.h2
            id="pricing-title"
            initial={topInit}
            animate={topAnimate(0.1)}
            transition={topTransition(0.1)}
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            اشتراك واحد. كل البيت يستفيد.
          </motion.h2>
          <motion.p
            initial={topInit}
            animate={topAnimate(0.2)}
            transition={topTransition(0.2)}
            className="max-w-[600px] text-base leading-[1.7] text-ink-muted lg:text-lg"
          >
            غيّري اشتراكك أو ألغيه بضغطة. أول 7 أيام مجانية، وضمان استرداد 14 يوم بعدها.
          </motion.p>

          <motion.div
            initial={topInit}
            animate={topAnimate(0.3)}
            transition={topTransition(0.3)}
            className="mt-8 flex flex-row items-center justify-center gap-4"
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`min-h-11 px-1 text-sm font-medium transition-colors ${
                billing === "monthly" ? "text-ink" : "text-ink-muted"
              }`}
            >
              شهري
            </button>
            <span className="inline-flex min-h-11 min-w-11 items-center justify-center">
              <Switch
                checked={billing === "annual"}
                onCheckedChange={(checked) =>
                  setBilling(checked ? "annual" : "monthly")
                }
                aria-label="billing period"
              />
            </span>
            <div className="flex flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => setBilling("annual")}
                className={`min-h-11 px-1 text-sm font-medium transition-colors ${
                  billing === "annual" ? "text-ink" : "text-ink-muted"
                }`}
              >
                سنوي
              </button>
              <AnimatePresence>
                {billing === "monthly" && (
                  <motion.span
                    key="discount-badge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "easeOut" as const }}
                    className="rounded-full bg-brand-yellow/15 px-2 py-0.5 text-xs font-semibold text-brand-yellow-dark"
                  >
                    وفّري 20%
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </header>

        <div className="mt-16 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6">
          {tiers.map((tier, i) => (
            <PricingCard
              key={tier.name}
              tier={tier}
              index={i}
              billing={billing}
              reduced={reduced}
            />
          ))}
        </div>

        <ul className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-8">
          {trustItems.map(({ Icon, label }) => (
            <li
              key={label}
              className="flex flex-row items-center gap-2 text-sm font-medium text-ink-muted"
            >
              <Icon
                className="size-4 shrink-0 text-ink-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-sm font-medium text-ink-muted">
          نقبل: مدى • Apple Pay • Visa • Mastercard • تابي • تمارا
        </p>
      </div>
    </section>
  );
}
