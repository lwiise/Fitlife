"use client";

import { useState } from "react";
import Image from "next/image";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Callout {
  title: string;
  description: string;
  x: number; // percentage from start (right in RTL)
  y: number; // percentage from top
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
    tabLabel: "تسمية تبويب ١",
    imageSrc: "/demo-dashboard-1.png",
    callouts: [
      {
        title: "نص تجريبي ١",
        description: "وصف تجريبي قصير للنقطة الأولى.",
        x: 18,
        y: 22,
      },
      {
        title: "نص تجريبي ٢",
        description: "وصف تجريبي قصير للنقطة الثانية.",
        x: 50,
        y: 48,
      },
      {
        title: "نص تجريبي ٣",
        description: "وصف تجريبي قصير للنقطة الثالثة.",
        x: 76,
        y: 72,
      },
    ],
  },
  {
    tabLabel: "تسمية تبويب ٢",
    imageSrc: "/demo-dashboard-2.png",
    callouts: [
      {
        title: "نص تجريبي ٤",
        description: "وصف تجريبي قصير.",
        x: 24,
        y: 30,
      },
      {
        title: "نص تجريبي ٥",
        description: "وصف تجريبي قصير.",
        x: 60,
        y: 56,
      },
      {
        title: "نص تجريبي ٦",
        description: "وصف تجريبي قصير.",
        x: 38,
        y: 78,
      },
    ],
  },
  {
    tabLabel: "تسمية تبويب ٣",
    imageSrc: "/demo-dashboard-3.png",
    callouts: [
      {
        title: "نص تجريبي ٧",
        description: "وصف تجريبي قصير.",
        x: 22,
        y: 36,
      },
      {
        title: "نص تجريبي ٨",
        description: "وصف تجريبي قصير.",
        x: 68,
        y: 42,
      },
      {
        title: "نص تجريبي ٩",
        description: "وصف تجريبي قصير.",
        x: 46,
        y: 74,
      },
    ],
  },
];

function CalloutMark({ callout }: { callout: Callout }) {
  return (
    <div
      className="absolute z-10 flex items-center gap-2"
      style={{
        insetInlineStart: `${callout.x}%`,
        top: `${callout.y}%`,
      }}
    >
      <span className="relative flex h-3 w-3 flex-shrink-0">
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-yellow opacity-30"
        />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-yellow" />
      </span>
      <span className="rounded-lg bg-white px-3 py-2 shadow-md ring-1 ring-ink/5">
        <span className="block text-[11px] font-bold text-foreground">
          {callout.title}
        </span>
        <span className="mt-0.5 block text-[10px] text-ink-muted">
          {callout.description}
        </span>
      </span>
    </div>
  );
}

export default function ProductDemo({
  screenshots = DEFAULT_SCREENSHOTS,
}: ProductDemoProps) {
  const [active, setActive] = useState("0");

  return (
    <section
      id="product-demo"
      aria-labelledby="demo-title"
      className="relative bg-surface py-16 lg:py-24"
    >
      <div className="container-page flex flex-col items-center">
        {/* TOP BLOCK — centered */}
        <header className="flex max-w-[600px] flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-brand-purple-700">
            نص تجريبي للتسمية
          </span>
          <h2
            id="demo-title"
            className="text-balance text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground lg:text-[2.5rem]"
          >
            نص تجريبي طويل للعنوان الرئيسي للقسم
          </h2>
          <p className="text-base leading-[1.7] text-ink-muted">
            نص تجريبي للفقرة التوضيحية تحت العنوان، يجب أن يكون كافيًا لاختبار
            التغليف على عدة أسطر من النص.
          </p>
        </header>

        {/* MAIN VISUAL AREA */}
        <div className="mt-16 w-full">
          <Tabs value={active} onValueChange={setActive} className="gap-0">
            {/* DEVICE FRAME */}
            <div className="overflow-hidden rounded-2xl border border-ink/15 bg-surface-elevated shadow-2xl">
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

              {/* Screenshot area — aspect ratio responsive */}
              {screenshots.map((screen, i) => (
                <TabsContent
                  key={i}
                  value={String(i)}
                  forceMount
                  className="relative m-0 aspect-[9/19.5] data-[state=inactive]:hidden lg:aspect-[16/10]"
                >
                  <Image
                    src={screen.imageSrc}
                    alt={screen.tabLabel}
                    fill
                    sizes="(max-width: 1024px) 100vw, 80vw"
                    className="object-cover"
                  />
                  {screen.callouts.map((callout, j) => (
                    <CalloutMark key={j} callout={callout} />
                  ))}
                </TabsContent>
              ))}
            </div>

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
