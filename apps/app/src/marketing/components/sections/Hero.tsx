import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/marketing/components/ui/carousel";
import { TrackedButton, TrackedLink } from "@/marketing/components/TrackedLink";
import { getSignupUrl } from "@/marketing/lib/appUrls";
import { cn } from "@/marketing/lib/utils";

// Server component on purpose: the hero is the LCP surface, so its headline and
// card photos must be in the first HTML paint. Entrance animation is pure CSS
// (`hero-rise` in globals.css) instead of motion/react — the old JS-driven
// entrance server-rendered everything at opacity:0 and kept the whole viewport
// invisible until hydration finished (plus up to ~2s of stagger delays).
// Interactivity (analytics clicks, the mobile carousel) lives in small client
// leaves.

// TODO: Replace 5 placeholder SVG silhouettes with real cutout photography
// (transparent-background PNGs) before launch. Real photos: women/men in Gulf/Filipino
// attire, friendly expressions, similar editorial style to the Clevora reference.

type FamilyMember = {
  label: string;
  sublabel?: string;
  imageSrc: string;
  imageAlt: string;
  accentColor: string; // hex — used for gradient overlay + card bg fallback
  textColor: string;
  hasPlayButton?: boolean;
};

const familyMembers: FamilyMember[] = [
  {
    label: "خطة للأب",
    sublabel: "اللي على حمية",
    imageSrc: "/family-dad.webp",
    imageAlt: "صورة الأب — رجل خليجي يبتسم",
    accentColor: "#D9B0FC",
    textColor: "text-[#4E2490]",
  },
  {
    label: "وجبات الأم",
    sublabel: "بسعرات محسوبة",
    imageSrc: "/family-mom.webp",
    imageAlt: "صورة الأم — امرأة خليجية بحجاب تبتسم",
    accentColor: "#C5458F",
    textColor: "text-white",
  },
  {
    label: "تطبخ للعائلة",
    sublabel: "بلغتها",
    imageSrc: "/family-housekeeper.webp",
    imageAlt: "صورة الخدامة — امرأة فلبينية تبتسم",
    accentColor: "#F2BB16",
    textColor: "text-[#4E2490]",
    hasPlayButton: true,
  },
  {
    label: "للأولاد",
    sublabel: "حسب أعمارهم",
    imageSrc: "/family-daughter.webp",
    imageAlt: "صورة البنت — طفلة سعيدة",
    accentColor: "#4E2490",
    textColor: "text-white",
  },
  {
    label: "كل البيت",
    sublabel: "في خطة واحدة",
    imageSrc: "/family-son.webp",
    imageAlt: "صورة الولد — طفل سعيد",
    accentColor: "#E89B5A",
    textColor: "text-[#1A1023]",
  },
];

// Literal class strings so Tailwind's scanner picks them up.
const cardDelays = [
  "[animation-delay:240ms]",
  "[animation-delay:320ms]",
  "[animation-delay:400ms]",
  "[animation-delay:480ms]",
  "[animation-delay:560ms]",
];

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

function FamilyCard({ member, index }: { member: FamilyMember; index: number }) {
  return (
    <div
      style={{ backgroundColor: member.accentColor }}
      className={cn(
        "group relative aspect-[3/4] cursor-default overflow-hidden rounded-3xl shadow-xl",
        "hero-rise transition-transform duration-300 ease-out hover:-translate-y-2.5",
        cardDelays[index],
      )}
    >
      {/* Photo fills entire card */}
      <div className="absolute inset-0 z-0">
        <Image
          src={member.imageSrc}
          alt={member.imageAlt}
          fill
          sizes="(max-width: 768px) 60vw, 20vw"
          // The first two cards are in the initial viewport on both layouts —
          // preload them (LCP candidates on mobile). The rest lazy-load.
          priority={index < 2}
          className="object-cover object-top"
        />
      </div>

      {/* Brand-color gradient overlay at top — gives label backdrop + ties photo to card brand */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[55%]"
        style={{
          background: `linear-gradient(to bottom, ${member.accentColor} 0%, ${member.accentColor}E6 20%, ${member.accentColor}80 40%, ${member.accentColor}33 65%, transparent 100%)`,
        }}
      />

      {/* Decorative leaves sit on the gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 overflow-hidden"
      >
        <DecorativeLeaves textColorClass={member.textColor} />
      </div>

      {/* Label on top of everything */}
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

      {member.hasPlayButton && (
        <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center">
          <TrackedButton
            event="hero_video_clicked"
            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg transition-colors hover:bg-[#1A1023] hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlayIcon className="size-4" />
            <span>شغّلي الفيديو</span>
          </TrackedButton>
        </div>
      )}
    </div>
  );
}

function MomFloatingCard() {
  return (
    <div className="hero-rise [animation-delay:400ms] absolute top-[150px] start-[3%] z-20 hidden w-[235px] -rotate-[3deg] transition-transform duration-300 motion-safe:hover:rotate-0 xl:block">
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
    </div>
  );
}

function HousekeeperFloatingCard() {
  return (
    <div className="hero-rise [animation-delay:520ms] absolute top-[180px] end-[3%] z-20 hidden w-[235px] rotate-[3deg] transition-transform duration-300 motion-safe:hover:rotate-0 xl:block">
      <div className="rounded-2xl border border-[#1A1023]/5 bg-white p-4 shadow-xl">
        <div className="flex flex-row items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-[#E89B5A] text-sm font-bold text-white">
            R
          </div>
          <div className="min-w-0 flex-1 text-start" dir="ltr">
            <p className="text-sm font-bold text-[#1A1023]">Rosa M.</p>
            <p className="text-xs text-[#1A1023]/60">Tagalog · Family cook</p>
          </div>
        </div>
        <div className="mt-3 text-start" dir="ltr">
          <p className="mb-1 text-xs font-bold text-[#1A1023]">
            Cooking today for the family
          </p>
          <p className="text-sm font-bold text-primary">Chicken Kabsa · for 4</p>
          <p className="mt-1 text-xs leading-snug text-[#1A1023]/60">
            500g chicken · 2 cups rice — simmer 25 min
          </p>
          <p className="mt-2 text-[10px] text-[#1A1023]/50">
            In your language · Tagalog
          </p>
        </div>
      </div>
    </div>
  );
}

function SaraPill() {
  return (
    <div className="hero-rise [animation-delay:520ms] absolute bottom-[5%] start-[5%] z-10 hidden lg:block">
      <div className="inline-flex items-center gap-2.5 rounded-full bg-[#1A1023] px-4 py-2 text-white shadow-lg">
        <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-pink to-brand-lavender text-xs font-bold">
          س
        </div>
        <div className="text-start">
          <p className="text-xs font-bold leading-tight">ساره الشيخ</p>
          <p className="text-[10px] leading-tight text-white/60">
            خبيرة تغذية
          </p>
        </div>
      </div>
    </div>
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
  return (
    <section
      aria-label="القسم الرئيسي"
      className="relative overflow-hidden pt-24 pb-0 md:pt-32"
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

      {/* Floating cards are positioned against the full-width section (not the
          1280px container) so they sit in the viewport gutters, clear of the
          centred headline. */}
      <MomFloatingCard />
      <HousekeeperFloatingCard />

      <div className="container-page relative pb-32">
        <div className="relative mx-auto max-w-5xl pt-6 text-center md:pt-20">
          <h1 className="font-extrabold leading-[0.95] tracking-tight">
            <span className="hero-rise block text-[clamp(34px,7vw,96px)] text-[#1A1023]">
              خطة غذائية للعائلة.
            </span>
            <span className="hero-rise [animation-delay:120ms] mt-2 block text-[clamp(34px,7vw,96px)] text-[#1A1023]">
              وتعليمات الطبخ
            </span>
            <span className="hero-rise [animation-delay:240ms] mt-2 block text-[clamp(34px,7vw,96px)] text-primary">
              توصل للخدامة بلغتها.
            </span>
          </h1>

          <p className="hero-rise [animation-delay:360ms] mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#1A1023]/70 md:mt-8 md:text-xl">
            ذكاء اصطناعي يصمم خطة لكل فرد في عائلتك بلغته، بإشراف خبيرة تغذية سعودية. كل فرد بـ ٨ أسئلة، والعائلة كوحدة.
          </p>

          <div className="hero-rise [animation-delay:440ms] mt-6 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
            <TrackedLink
              event="hero_cta_clicked"
              href={getSignupUrl()}
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-[#1A1023] px-7 py-3.5 text-base font-bold text-white shadow-lg transition-colors duration-200 hover:bg-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
            >
              <span>ابدئي خطتك المجانية</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </TrackedLink>
            <TrackedLink
              event="secondary_cta_clicked"
              eventProps={{ section: "hero" }}
              href="#how-it-works"
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full border border-[#1A1023]/10 bg-white px-7 py-3.5 text-base font-bold text-[#1A1023] shadow-md transition-colors duration-200 hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
            >
              <span>شوفي كيف يشتغل</span>
            </TrackedLink>
          </div>
        </div>

        <SaraPill />
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
                  <FamilyCard member={member} index={idx} />
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
                    <FamilyCard member={member} index={idx} />
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
