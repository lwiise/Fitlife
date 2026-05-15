import {
  ChefHat,
  Globe,
  HelpCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

type Pain = { Icon: LucideIcon; text: string };

const pains: Pain[] = [
  {
    Icon: ChefHat,
    text: "تطبخين 4 وجبات مختلفة كل ليلة. واحدة لك، وحدة لزوجك الحمية، ثالثة للأولاد، ورابعة للخادمة.",
  },
  {
    Icon: Globe,
    text: "كل تطبيقات التغذية بالإنجليزي. خادمتك من الفلبين، إندونيسيا، أو إثيوبيا — وما تفهم وش لازم تطبخ لك.",
  },
  {
    Icon: Receipt,
    text: "تدفعين 200 ريال للجلسة عند اختصاصية. بعد شهرين ترجعين للصفر، وللاختصاصية مرة ثانية.",
  },
  {
    Icon: HelpCircle,
    text: "ما تعرفين كم بروتين يحتاج طفلك بعمر 8 سنوات، ولا كم سعرة لازم تأكل أنتِ بعد الولادة.",
  },
];

export default function Problem() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-title"
      className="relative scroll-mt-24 bg-surface py-20 lg:py-28"
    >
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
        <RevealOnScroll
          as="header"
          className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:self-start"
        >
          <span className="text-sm font-semibold text-primary">نعرف بالضبط</span>
          <h2
            id="problem-title"
            className="text-h2 text-balance text-foreground"
          >
            أعراف يومك يا أم البيت.
          </h2>
          <p className="text-lg leading-loose text-ink-muted">
            كل تطبيقات التغذية اللي جربتيها كانت مصممة لعائلة غربية بشخص واحد.
            لكن بيتك مختلف.
          </p>
        </RevealOnScroll>

        <ul className="flex flex-col gap-6 lg:col-span-3 lg:col-start-1 lg:row-start-1">
          {pains.map(({ Icon, text }, i) => (
            <RevealOnScroll
              key={text}
              as="li"
              delayIndex={i}
              axis="x"
              offset={30}
              className="list-none"
            >
              <article className="transform-gpu rounded-2xl border border-ink/10 bg-surface-elevated p-7 transition-[transform,border-color] duration-200 ease-out hover:scale-[1.01] hover:border-brand-pink/30 motion-reduce:transition-none motion-reduce:hover:scale-100">
                <Icon
                  className="size-6 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <p className="mt-5 text-lg leading-relaxed text-balance text-foreground">
                  {text}
                </p>
              </article>
            </RevealOnScroll>
          ))}
        </ul>
      </div>
    </section>
  );
}
