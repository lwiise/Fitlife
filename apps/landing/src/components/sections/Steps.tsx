import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Reveal } from "@/components/motion/Reveal";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { whatsappUrl } from "@/lib/config";

// "كيف تستلمين منتجاتك" — the one section (besides the footer) that carries
// the WhatsApp link, per the offer flow: buy → send invoice → receive files.
const STEPS: { text: string; whatsappCta?: boolean }[] = [
  { text: "اشتري الباقة من هذه الصفحة بعملية دفع واحدة." },
  { text: "أرسلي صورة فاتورة الشراء على واتساب.", whatsappCta: true },
  {
    text: "اختاري ما يناسبك وسنرسل لك: برنامج التمارين المناسب لهدفك ومستواك + الجدول الغذائي حسب سعراتك (1800 – 2900 سعرة). بقية الملفات الرقمية تُسلَّم لك مباشرة بعد الشراء.",
  },
];

// Three cards threaded onto one rail: the hairline draws across as the section
// arrives and each card's gold node sits on it, so the steps read as a single
// route rather than three loose tiles.
export function Steps() {
  return (
    <section aria-labelledby="steps-title">
      <div className="container-page section-shell">
        <Reveal>
          <SectionEyebrow index="03" />
          <h2
            id="steps-title"
            className="text-offer-h2 mt-4 text-brand-purple-900"
          >
            ٣ خطوات وتبدئين
          </h2>
        </Reveal>

        <div className="relative mt-20 md:mt-24">
          {/* The rail. Runs behind the cards and shows through the gutters;
              each card's node sits on it in the page's own surface colour, so
              the line reads as threaded rather than crossed out. */}
          <span
            aria-hidden
            className="rule-grow absolute inset-x-0 top-0 hidden h-px bg-brand-ink/15 md:block"
          />

          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.text} as="li" delayIndex={i} className="relative">
                <div className="card-lift panel-elevated hover:panel-elevated-hover relative h-full overflow-hidden rounded-3xl px-7 pt-14 pb-7 md:px-8 md:pt-16 md:pb-9">
                  <span
                    aria-hidden
                    className="text-gold-500/12 absolute -top-6 end-4 text-[7.5rem] leading-none font-extrabold tabular-nums select-none"
                  >
                    {i + 1}
                  </span>
                  <div className="relative flex h-full flex-col gap-6">
                    <p className="leading-[1.85] font-medium text-brand-ink">
                      {step.text}
                    </p>
                    {step.whatsappCta && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lift bg-whatsapp mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-brand-ink shadow-[0_8px_20px_-10px_rgba(37,211,102,0.9)] hover:shadow-[0_14px_28px_-10px_rgba(37,211,102,0.9)]"
                      >
                        <WhatsAppIcon className="size-5" />
                        أرسلي الفاتورة على واتساب
                      </a>
                    )}
                  </div>
                </div>

                {/* Node on the rail — a gold-ringed index in the page surface. */}
                <span
                  aria-hidden
                  className="absolute top-0 start-7 -translate-y-1/2 md:start-8"
                >
                  <span className="pop-in text-gold-700 flex size-11 items-center justify-center rounded-full bg-brand-surface text-base font-extrabold tabular-nums ring-1 ring-gold-700/30">
                    {i + 1}
                  </span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
