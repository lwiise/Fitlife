import { WhatsAppIcon } from "@/marketing/bundle/WhatsAppIcon";
import { Reveal } from "@/marketing/bundle/Reveal";
import { SectionEyebrow } from "@/marketing/bundle/ui/section-eyebrow";
import { whatsappUrl } from "@/marketing/bundle/config";

// "كيف تستلمين منتجاتك" — the one section (besides the footer) that carries
// the WhatsApp link, per the offer flow: buy → send invoice → receive files.
const STEPS: { text: string; whatsappCta?: boolean }[] = [
  { text: "اشتري الباقة من هذه الصفحة بعملية دفع واحدة." },
  { text: "أرسلي صورة فاتورة الشراء على واتساب.", whatsappCta: true },
  {
    text: "اختاري ما يناسبك وسنرسل لك: برنامج التمارين المناسب لهدفك ومستواك + الجدول الغذائي حسب سعراتك (1800 – 2900 سعرة). بقية الملفات الرقمية تُسلَّم لك مباشرة بعد الشراء.",
  },
];

// Three cards, each carrying a gold-ringed index that straddles its top edge.
//
// There used to be a hairline rail drawn across the section with every node
// sitting on it, so the steps read as one route rather than three tiles. It was
// removed by owner request; the numbering — the ghost figure inside each card
// and the ringed index on its edge — is what carries the sequence now.
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

        {/* No `relative` here any more — the rail was the only thing that
            positioned against this box. The nodes below anchor to their own
            <li>, which carries its own `relative`. */}
        <div className="mt-20 md:mt-24">
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

                {/* The step index, straddling the card's top edge.
                    `bg-brand-surface` is the PAGE ground (#ebeff2), not the
                    card's (#ffffff) — it was opaque so the rail appeared to
                    thread behind the node rather than strike through it. With
                    the rail gone the fill still earns its place: it keeps the
                    disc reading as punched out of the page and sitting in front
                    of the card, which is what the half-overlap is for. */}
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
