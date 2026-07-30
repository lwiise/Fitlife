import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/marketing/components/ui/accordion";

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

export function FAQ() {
  return (
    <section aria-labelledby="faq-title" className="bg-brand-purple-50">
      <div className="container-page py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p
            aria-hidden
            className="text-gold-700 flex items-center gap-3 text-sm font-extrabold tabular-nums"
          >
            04
            <span className="bg-gold-700/40 h-px w-10" />
          </p>
          <h2
            id="faq-title"
            className="text-offer-h2 mt-3 text-brand-purple-900"
          >
            الأسئلة الشائعة
          </h2>

          {/* Radix direction comes from the /landing layout's DirProvider.
              Open items get a gold start-edge bar and gentle indent. */}
          <Accordion type="single" collapsible className="mt-10">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.question}
                value={`faq-${i}`}
                className="before:bg-gold-500 relative transition-[padding] duration-300 before:absolute before:inset-y-4 before:start-0 before:w-1 before:rounded-full before:opacity-0 before:transition-opacity data-[state=open]:ps-5 data-[state=open]:before:opacity-100 motion-reduce:transition-none"
              >
                <AccordionTrigger className="min-h-14 items-center py-5 text-lg font-bold text-brand-ink hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-[1.7] text-brand-ink-muted">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
