import { WhatsAppIcon } from "@/marketing/bundle/WhatsAppIcon";
import { RevealOnScroll } from "@/marketing/components/motion/RevealOnScroll";
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

export function Steps() {
  return (
    <section aria-labelledby="steps-title">
      <div className="container-page py-20 md:py-28">
        <p
          aria-hidden
          className="text-gold-700 flex items-center gap-3 text-sm font-extrabold tabular-nums"
        >
          03
          <span className="bg-gold-700/40 h-px w-10" />
        </p>
        <h2 id="steps-title" className="text-offer-h2 mt-3 text-brand-purple-900">
          ٣ خطوات وتبدئين
        </h2>

        <ol className="mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <RevealOnScroll key={step.text} as="li" delayIndex={i}>
              <div className="relative h-full overflow-hidden rounded-2xl bg-brand-surface-elevated p-6 pt-20 shadow-sm">
                <span
                  aria-hidden
                  className="absolute -top-5 end-3 text-[7rem] leading-none font-extrabold text-brand-purple-100 tabular-nums select-none"
                >
                  {i + 1}
                </span>
                <div className="relative flex h-full flex-col gap-5">
                  <p className="leading-[1.7] font-medium text-brand-ink">
                    {step.text}
                  </p>
                  {step.whatsappCta && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-whatsapp mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
                    >
                      <WhatsAppIcon className="size-5" />
                      أرسلي الفاتورة على واتساب
                    </a>
                  )}
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </ol>
      </div>
    </section>
  );
}
