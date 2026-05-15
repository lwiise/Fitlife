import {
  Camera,
  ChefHat,
  Languages,
  MessageCircleHeart,
  Sparkles,
  Watch,
  type LucideIcon,
} from "lucide-react";

type Card = {
  area: "card1" | "card2" | "card3" | "card4" | "card5" | "card6";
  areaClass: string;
  Icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  title: string;
  description: string;
  large?: boolean;
};

const cards: Card[] = [
  {
    area: "card1",
    areaClass: "md:[grid-area:card1]",
    Icon: Sparkles,
    iconBgClass: "bg-brand-yellow/15",
    iconColorClass: "text-brand-yellow-dark",
    title: "نص تجريبي للميزة الأولى الكبيرة",
    description:
      "وصف تجريبي للميزة الكبيرة الأولى — يحتاج نصًا أطول قليلًا لاختبار المحاذاة في البطاقة الواسعة عبر عمودين.",
    large: true,
  },
  {
    area: "card2",
    areaClass: "md:[grid-area:card2]",
    Icon: Languages,
    iconBgClass: "bg-primary/10",
    iconColorClass: "text-primary",
    title: "نص تجريبي ٢",
    description: "وصف تجريبي قصير للبطاقة الثانية.",
  },
  {
    area: "card3",
    areaClass: "md:[grid-area:card3]",
    Icon: MessageCircleHeart,
    iconBgClass: "bg-brand-pink/10",
    iconColorClass: "text-brand-pink",
    title: "نص تجريبي ٣",
    description: "وصف تجريبي قصير للبطاقة الثالثة.",
  },
  {
    area: "card4",
    areaClass: "md:[grid-area:card4]",
    Icon: Camera,
    iconBgClass: "bg-brand-lavender/40",
    iconColorClass: "text-primary",
    title: "نص تجريبي ٤",
    description: "وصف تجريبي قصير للبطاقة الرابعة.",
  },
  {
    area: "card5",
    areaClass: "md:[grid-area:card5]",
    Icon: ChefHat,
    iconBgClass: "bg-brand-yellow/15",
    iconColorClass: "text-brand-yellow-dark",
    title: "نص تجريبي ٥",
    description: "وصف تجريبي قصير للبطاقة الخامسة.",
  },
  {
    area: "card6",
    areaClass: "md:[grid-area:card6]",
    Icon: Watch,
    iconBgClass: "bg-primary/10",
    iconColorClass: "text-primary",
    title: "نص تجريبي للميزة السادسة الكبيرة",
    description:
      "وصف تجريبي للميزة الكبيرة السادسة — هذه البطاقة تمتد عبر الأعمدة الثلاثة لتشكّل نهاية بصرية للقسم.",
    large: true,
  },
];

function DecorativeMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 40"
      width="120"
      height="40"
      className="pointer-events-none absolute bottom-6 end-6 text-brand-yellow/50"
    >
      <path
        d="M 4 32 C 30 12, 60 32, 90 18 S 116 24, 116 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="116" cy="24" r="3" fill="currentColor" />
    </svg>
  );
}

export default function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="relative bg-surface py-16 lg:py-24"
    >
      <div className="container-page flex flex-col items-center">
        {/* TOP BLOCK — centered */}
        <header className="flex max-w-[600px] flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-brand-purple-700">
            نص تجريبي للتسمية
          </span>
          <h2
            id="features-title"
            className="text-balance text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground lg:text-[2.5rem]"
          >
            نص تجريبي طويل للعنوان الرئيسي للقسم
          </h2>
        </header>

        {/* BENTO GRID — non-uniform via grid-template-areas */}
        <div
          className="mt-16 grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 md:[grid-template-areas:'card1_card1'_'card2_card3'_'card4_card5'_'card6_card6'] lg:grid-cols-3 lg:gap-6 lg:[grid-template-areas:'card1_card1_card2'_'card3_card4_card5'_'card6_card6_card6']"
        >
          {cards.map(
            ({
              area,
              areaClass,
              Icon,
              iconBgClass,
              iconColorClass,
              title,
              description,
              large,
            }) => (
              <article
                key={area}
                className={`group/card relative flex flex-col gap-4 rounded-2xl border border-ink/[0.08] bg-surface-elevated transition-[transform,border-color] duration-200 ease-out hover:scale-[1.005] hover:border-brand-purple-300 ${large ? "p-8" : "p-6"} ${areaClass}`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgClass}`}
                >
                  <Icon
                    className={`size-6 ${iconColorClass}`}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <h3
                  className={`font-bold leading-tight text-foreground ${large ? "text-[22px]" : "text-xl"}`}
                >
                  {title}
                </h3>
                <p className="text-base leading-[1.7] text-ink-muted">
                  {description}
                </p>
                {large && <DecorativeMark />}
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
