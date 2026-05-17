// TODO: Replace placeholder screenshots in /public/ before launch
"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface Callout {
  title: string;
  description: string;
  x: number;
  y: number;
}

interface Screenshot {
  tabLabel: string;
  imageSrc: string;
  callouts: Callout[];
}

interface ProductDemoProps {
  screenshots?: Screenshot[];
}

const DEFAULT_SCREENSHOTS: Screenshot[] = [
  {
    tabLabel: "لوحة التحكم",
    imageSrc: "/demo-dashboard.png",
    callouts: [
      {
        title: "خطط الأكل",
        description: "وصفات خليجية أصيلة",
        x: 60,
        y: 25,
      },
      {
        title: "حساب الخادمة",
        description: "بلغتها، مع صور للوصفات",
        x: 30,
        y: 50,
      },
      {
        title: "المساعدة الذكية",
        description: "تجاوب 24/7 بالعربي",
        x: 75,
        y: 70,
      },
    ],
  },
  {
    tabLabel: "خطة اليوم",
    imageSrc: "/demo-day.png",
    callouts: [
      { title: "الفطور", description: "بسعرات محسوبة", x: 50, y: 20 },
      {
        title: "الكميات للعائلة",
        description: "كل واحد بكميته",
        x: 40,
        y: 55,
      },
      {
        title: "بدائل صحية",
        description: "غيري المكونات بضغطة",
        x: 60,
        y: 80,
      },
    ],
  },
  {
    tabLabel: "المحادثة",
    imageSrc: "/demo-chat.png",
    callouts: [
      {
        title: "اسألي بالعربي",
        description: "الذكاء يفهم لهجتك",
        x: 40,
        y: 30,
      },
      {
        title: "اقتراحات فورية",
        description: "بدائل لو حابة شي",
        x: 65,
        y: 60,
      },
      {
        title: "حفظ التفضيلات",
        description: "يتعلم من اختياراتك",
        x: 35,
        y: 80,
      },
    ],
  },
];

function CalloutMark({
  callout,
  index,
  reduce,
  sequenceDelayMs,
}: {
  callout: Callout;
  index: number;
  reduce: boolean | null;
  sequenceDelayMs: number;
}) {
  // Per-callout phase timing (relative to sequence start)
  const callotStaggerMs = sequenceDelayMs + index * 600;
  const dotDelayS = callotStaggerMs / 1000;
  const labelDelayS = (callotStaggerMs + 6000) / 1000;

  return (
    <div
      className="absolute z-10 flex items-center gap-2"
      style={{
        insetInlineStart: `${callout.x}%`,
        top: `${callout.y}%`,
      }}
    >
      {/* Pulsing dot — wrapper holds the static dot + animated ring */}
      <motion.span
        className="relative flex h-3 w-3 flex-shrink-0"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" as const, delay: dotDelayS }}
      >
        {/* Continuous pulse ring */}
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-brand-yellow"
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut" as const,
              delay: dotDelayS + 0.2,
            }}
          />
        )}
        {/* Solid dot */}
        <span
          aria-hidden="true"
          className="relative inline-flex h-3 w-3 rounded-full bg-brand-yellow ring-2 ring-white"
        />
      </motion.span>

      {/* Label — appears ~6s after dot per spec (slow-reveal signature) */}
      <motion.span
        className="rounded-lg bg-white px-3 py-2 shadow-md ring-1 ring-ink/5"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.3,
          ease: "easeOut" as const,
          delay: reduce ? 0 : labelDelayS,
        }}
      >
        <span className="block text-[11px] font-bold text-foreground">
          {callout.title}
        </span>
        <span className="mt-0.5 block text-[10px] text-ink-muted">
          {callout.description}
        </span>
      </motion.span>
    </div>
  );
}

export default function ProductDemo({
  screenshots = DEFAULT_SCREENSHOTS,
}: ProductDemoProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState("0");
  const topRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });
  const frameInView = useInView(frameRef, { amount: 0.3, once: true });

  const topItem = (delayMs: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: topInView ? { opacity: 1, y: 0 } : undefined,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      delay: delayMs / 1000,
    },
  });

  // Callout sequence starts 700ms after frame is in view (device settles at 700ms)
  const calloutSequenceDelayMs = 700;

  return (
    <section
      id="product-demo"
      aria-labelledby="demo-title"
      className="relative bg-surface py-16 lg:py-24"
    >
      <div className="container-page flex flex-col items-center">
        {/* TOP BLOCK — centered, 100ms stagger */}
        <motion.header
          ref={topRef}
          className="flex max-w-[600px] flex-col items-center gap-3 text-center"
        >
          <motion.span
            className="text-sm font-semibold tracking-wide text-brand-pink"
            {...topItem(0)}
          >
            اللي حتشوفينه فعلاً
          </motion.span>
          <motion.h2
            id="demo-title"
            className="text-balance text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground lg:text-[2.5rem]"
            {...topItem(100)}
          >
            ما يحتاج تتخيلين — شوفي بنفسك.
          </motion.h2>
          <motion.p
            className="text-lg leading-[1.7] text-ink-muted"
            {...topItem(200)}
          >
            هذي صور حقيقية من التطبيق. مو موك أب، مو تخمين.
          </motion.p>
        </motion.header>

        {/* MAIN VISUAL AREA */}
        <div className="mt-16 w-full">
          <Tabs value={active} onValueChange={setActive} className="gap-0">
            {/* DEVICE FRAME — entrance with cubic-bezier */}
            <motion.div
              ref={frameRef}
              className="overflow-hidden rounded-2xl border border-ink/15 bg-surface-elevated shadow-2xl"
              initial={
                reduce ? false : { opacity: 0, y: 40, scale: 0.96 }
              }
              animate={
                frameInView
                  ? { opacity: 1, y: 0, scale: 1 }
                  : undefined
              }
              transition={{
                duration: 0.7,
                ease: EASE_OUT_EXPO,
              }}
            >
              {/* Browser bar — dots on start side (right in RTL) */}
              <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-surface-elevated px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full bg-ink/20"
                  />
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full bg-ink/20"
                  />
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full bg-ink/20"
                  />
                </div>
                <div
                  className="text-xs font-medium text-ink-muted"
                  dir="ltr"
                >
                  fitlife.app
                </div>
                <div className="w-12" aria-hidden="true" />
              </div>

              {/* Screenshot area — aspect ratio responsive, crossfade between tabs */}
              {screenshots.map((screen, i) => (
                <TabsContent
                  key={i}
                  value={String(i)}
                  forceMount
                  className="relative m-0 aspect-[9/19.5] data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-0 data-[state=inactive]:opacity-0 data-[state=active]:opacity-100 lg:aspect-[16/10] transition-opacity duration-300"
                >
                  <Image
                    src={screen.imageSrc}
                    alt={screen.tabLabel}
                    fill
                    sizes="(max-width: 1024px) 100vw, 80vw"
                    className="object-cover"
                  />
                  {/* Re-key on activeTab so callouts remount + replay sequence on tab switch */}
                  <div key={`callouts-${active}-${i}`}>
                    {String(i) === active &&
                      frameInView &&
                      screen.callouts.map((callout, j) => (
                        <CalloutMark
                          key={j}
                          callout={callout}
                          index={j}
                          reduce={reduce}
                          sequenceDelayMs={calloutSequenceDelayMs}
                        />
                      ))}
                  </div>
                </TabsContent>
              ))}
            </motion.div>

            {/* TAB SWITCHER */}
            <TabsList
              variant="line"
              className="mx-auto mt-8 h-auto flex-wrap gap-3"
            >
              {screenshots.map((screen, i) => (
                <TabsTrigger
                  key={i}
                  value={String(i)}
                  className="h-11 px-4 text-sm font-semibold"
                >
                  {screen.tabLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
