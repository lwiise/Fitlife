import Image from "next/image";
import { ChevronLeft, Languages, Shield, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { RevealScale } from "@/components/motion/RevealScale";
import { HeroBackdrop } from "@/components/sections/HeroBackdrop";
import { HeroCallout } from "@/components/sections/HeroCallout";

type Trust = { Icon: LucideIcon; text: string };

const trust: Trust[] = [
  { Icon: Shield, text: "متوافق مع نظام حماية البيانات السعودي" },
  { Icon: Languages, text: "يدعم 7 لغات" },
  { Icon: Users, text: "+500 عائلة سعودية" },
];

export default function Hero() {
  return (
    <section
      aria-label="القسم الرئيسي"
      className="relative flex min-h-svh items-center overflow-hidden py-12 lg:h-svh lg:py-16"
    >
      <HeroBackdrop />

      <div className="container-page relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-5 lg:gap-12">
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Reveal
            as="span"
            delayMs={0}
            className="text-sm font-semibold tracking-wide text-brand-pink"
          >
            للعائلة الخليجية
          </Reveal>

          <Reveal
            as="h1"
            delayMs={50}
            className="text-display max-w-[16ch] text-balance text-foreground"
          >
            خطة غذائية لكل البيت — حتى الخادمة.
          </Reveal>

          <Reveal
            as="p"
            delayMs={150}
            className="max-w-[32ch] text-lg leading-[1.7] text-ink-muted lg:text-2xl"
          >
            ذكاء اصطناعي يصمم خطة لكل فرد في عائلتك، بلغته، في أقل من 30 ثانية.
            مدعوم بخبيرة تغذية سعودية.
          </Reveal>

          <Reveal
            delayMs={250}
            className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <Button
              size="lg"
              className="h-14 rounded-xl px-8 text-base font-bold shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              ابدئي خطتك المجانية
            </Button>
            <a
              href="#problem"
              className="group/secondary inline-flex min-h-11 items-center gap-2 py-2 text-base font-semibold text-brand-purple-700 transition-colors duration-200 hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              شوفي كيف تشتغل
              <ChevronLeft
                className="size-4 transition-transform duration-200 group-hover/secondary:-translate-x-1 rtl:group-hover/secondary:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/secondary:translate-x-0"
                aria-hidden="true"
              />
            </a>
          </Reveal>

          <Reveal as="p" delayMs={350} className="mt-4 text-sm text-ink-muted">
            بدون بطاقة ائتمان
            <span aria-hidden="true"> • </span>
            تجربة مجانية 7 أيام
            <span aria-hidden="true"> • </span>
            إلغاء بضغطة
          </Reveal>

          <Reveal
            as="ul"
            delayMs={450}
            className="group/trust mt-8 flex flex-col gap-3 md:flex-row md:gap-6 lg:mt-12"
          >
            {trust.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon
                  className="size-4 text-ink-muted transition-colors duration-200 group-hover/trust:text-primary motion-reduce:transition-none"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="text-sm text-ink-muted">{text}</span>
              </li>
            ))}
          </Reveal>
        </div>

        <RevealScale className="lg:col-span-2">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm rounded-2xl bg-surface-elevated ring-1 ring-ink/5 lg:max-w-none">
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <Image
                src="/hero-dashboard.png"
                alt="لوحة فيت لايف تعرض خططًا غذائية مخصصة لكل فرد في العائلة"
                width={640}
                height={800}
                priority
                sizes="(max-width: 1024px) 24rem, 40vw"
                className="relative h-full w-full object-cover"
              />
            </div>

            <HeroCallout placement="top-end" delayMs={850}>
              خطة الأم
            </HeroCallout>
            <HeroCallout placement="middle-start" delayMs={1050}>
              خطة الأطفال
            </HeroCallout>
            <HeroCallout placement="bottom-end" delayMs={1250}>
              خطة الخادمة
            </HeroCallout>
          </div>
        </RevealScale>
      </div>
    </section>
  );
}
