import { DirProvider } from "@/components/providers/direction-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="text-h2 text-brand-purple-900">
            الأسئلة الشائعة
          </h2>

          {/* Radix reads direction from context, not the html dir attribute —
              the provider scopes RTL to the one Radix consumer on the page. */}
          <DirProvider>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem key={item.question} value={`faq-${i}`}>
                  <AccordionTrigger className="min-h-14 items-center py-4 text-base font-bold text-brand-ink hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-base leading-[1.7] text-brand-ink-muted">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </DirProvider>
        </div>
      </div>
    </section>
  );
}
