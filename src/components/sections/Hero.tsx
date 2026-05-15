import { ChevronLeft, Languages, Shield, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Trust = { Icon: LucideIcon; text: string };

const trust: Trust[] = [
  { Icon: Shield, text: "نص تجريبي للثقة الأولى" },
  { Icon: Languages, text: "نص تجريبي للثقة الثانية" },
  { Icon: Users, text: "نص تجريبي للثقة الثالثة" },
];

export default function Hero() {
  return (
    <section
      id="hero"
      aria-label="القسم الرئيسي"
      className="relative isolate overflow-hidden bg-surface bg-noise py-14 sm:py-20 lg:flex lg:min-h-svh lg:max-h-svh lg:items-center lg:py-12"
    >
      <div className="container-page relative grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
        {/* TEXT COLUMN — start side (right in RTL), 8/12 = ~67% */}
        <div className="flex flex-col gap-6 lg:col-span-8 lg:col-start-1">
          <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-purple-700">
            <span
              aria-hidden="true"
              className="inline-block h-px w-10 bg-brand-purple-700"
            />
            نص تجريبي قصير
          </span>

          <h1 className="font-display max-w-[18ch] text-[clamp(3rem,1.8rem+4.5vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-foreground">
            نص تجريبي طويل لاختبار العربية في العنوان الرئيسي للقسم الأول
          </h1>

          <p className="max-w-[34ch] text-base leading-[1.7] text-ink-muted sm:text-lg">
            نص تجريبي طويل لاختبار العربية في الفقرة التوضيحية تحت العنوان
            الرئيسي. يجب أن يكون كافيًا لاختبار الأسطر المتعددة وتباعد الكلمات
            في اتجاه القراءة من اليمين إلى اليسار.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
            <Button
              size="lg"
              className="h-14 rounded-none px-9 text-base font-bold shadow-none transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--brand-yellow)] active:translate-y-0 active:shadow-[3px_3px_0_0_var(--brand-yellow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              زر رئيسي تجريبي
            </Button>
            <a
              href="#hero"
              className="group/secondary inline-flex min-h-11 items-center gap-2 py-2 text-base font-semibold text-brand-purple-700 transition-colors duration-200 hover:text-brand-purple-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              رابط ثانوي تجريبي
              <ChevronLeft
                className="size-4 transition-transform duration-200 group-hover/secondary:-translate-x-1 rtl:group-hover/secondary:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/secondary:translate-x-0"
                aria-hidden="true"
              />
            </a>
          </div>

          <p className="-mt-1 text-xs text-ink-muted/85">
            سطر طمأنة تجريبي قصير تحت زرّي الإجراء
          </p>

          <ul className="mt-2 flex flex-col gap-3 lg:mt-4 lg:flex-row lg:gap-6">
            {trust.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon
                  className="size-4 text-ink-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="text-sm text-ink-muted">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* VISUAL COLUMN — end side (left in RTL), 4/12 = ~33%, bleeds off edge */}
        <div className="lg:col-span-4 lg:col-start-9 lg:-me-6 xl:-me-12">
          {/* Magazine masthead row (desktop only) — editorial signature */}
          <div
            aria-hidden="true"
            className="mb-3 hidden items-baseline justify-between border-b border-ink/15 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-ink-muted lg:flex"
          >
            <span>القائمة · MENU</span>
            <span className="tabular-nums">٠١</span>
          </div>

          <div className="relative aspect-[3/4] w-full max-w-sm border border-ink/15 bg-surface-elevated lg:max-w-none">
            {/* Corner perforation marks — recipe-card metaphor */}
            <span aria-hidden="true" className="absolute top-1 start-1 h-1 w-1 rounded-full bg-ink/25" />
            <span aria-hidden="true" className="absolute top-1 end-1 h-1 w-1 rounded-full bg-ink/25" />
            <span aria-hidden="true" className="absolute bottom-1 start-1 h-1 w-1 rounded-full bg-ink/25" />
            <span aria-hidden="true" className="absolute bottom-1 end-1 h-1 w-1 rounded-full bg-ink/25" />

            <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-ink-muted">
              Hero Visual Placeholder
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
