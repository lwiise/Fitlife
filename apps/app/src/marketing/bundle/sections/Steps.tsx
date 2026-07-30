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
      <div className="container-page py-16 md:py-24">
        <h2 id="steps-title" className="text-h2 text-brand-purple-900">
          ٣ خطوات وتبدئين
        </h2>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <RevealOnScroll key={step.text} as="li" delayIndex={i}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <span
                  aria-hidden
                  className="inline-flex size-12 items-center justify-center rounded-full bg-brand-purple-100 text-2xl font-extrabold text-brand-purple-700 tabular-nums"
                >
                  {i + 1}
                </span>
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
            </RevealOnScroll>
          ))}
        </ol>
      </div>
    </section>
  );
}
