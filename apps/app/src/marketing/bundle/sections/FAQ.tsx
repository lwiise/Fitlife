import { Reveal } from "@/marketing/bundle/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/marketing/components/ui/accordion";
import { SectionEyebrow } from "@/marketing/bundle/ui/section-eyebrow";

const FAQ_ITEMS = [
  {
    question: "كيف أعرف أي برنامج تمارين وأي سعرات تناسبني؟",
    answer:
      "لا تشيلين هم الاختيار — بعد الشراء نساعدك نحدد الأنسب لك حسب هدفك ومستواك ووزنك.",
  },
  {
    question: "هل المنتجات رقمية؟",
    answer:
      "نعم، جميع الملفات رقمية تصلك مباشرة، والاستشارة والمتابعة تكون عبر المجموعة.",
  },
  {
    question: "هل أقدر أشتري منتج واحد بس؟",
    answer:
      "تقدرين، لكن سعر الباقة (888 ر.س) أقل من شراء الاستشارة والجدول الغذائي لوحدهم — فالباقة دائماً الخيار الأوفر.",
  },
  {
    question: "متى تبدأ المتابعة؟",
    answer: "مباشرة بعد إرسال فاتورتك على الواتساب وتحديد اختياراتك.",
  },
] as const;

// Same two-column rhythm as «لمن هذه الباقة؟» — parked heading, ruled rows —
// so the back half of the page reads as one system instead of four layouts.
export function FAQ() {
  return (
    <section aria-labelledby="faq-title" className="bg-brand-purple-50">
      <div className="container-page section-shell lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <SectionEyebrow index="04" />
          <h2 id="faq-title" className="text-offer-h2 mt-4 text-brand-purple-900">
            الأسئلة الشائعة
          </h2>
        </Reveal>

        {/* Radix direction comes from the layout's DirProvider. The gold
            start-edge bar is always in place and only fades in — hovering
            previews it, opening commits it — so nothing reflows on toggle. */}
        <Reveal className="mt-12 lg:mt-0">
          <Accordion
            type="single"
            collapsible
            className="border-t border-brand-ink/10"
          >
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.question}
                value={`faq-${i}`}
                className="before:bg-gold-500 relative border-b border-brand-ink/10 ps-5 before:absolute before:inset-y-6 before:start-0 before:w-1 before:rounded-full before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-45 data-[state=open]:before:opacity-100 motion-reduce:before:transition-none"
              >
                <AccordionTrigger className="min-h-16 items-center py-6 text-lg font-bold text-brand-ink hover:no-underline md:text-xl">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-7 text-base leading-[1.85] text-brand-ink-muted md:text-lg">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
