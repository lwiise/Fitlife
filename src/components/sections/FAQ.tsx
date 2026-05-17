"use client";

import { MessageCircle } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: "هل أحتاج اشتراك منفصل للخادمة؟",
    answer:
      "لا. باقة العائلة تشمل حساب الخادمة كاملاً، بلغتها، بدون أي رسوم إضافية. كل ما تحتاجين تسوينه هو إضافة اسمها واختيار لغتها في الإعدادات.",
  },
  {
    question: "هل الخطط مناسبة للحامل أو المرضعة؟",
    answer:
      "نعم، باقة البريميوم تتضمن خطط خاصة للحوامل والمرضعات، يراجعها فريق التغذية بقيادة ساره العتيبي. للحالات الخاصة مثل سكري الحمل أو ضغط الدم، الخطة تتعدل تلقائياً حسب فحوصاتك.",
  },
  {
    question: "هل النظام يعرف الأكلات الخليجية؟",
    answer:
      "نعم. مكتبتنا تحتوي على أكثر من 800 وصفة خليجية أصيلة، من الكبسة الصحية للمندي بسعرات محسوبة. كلها مطبوخة ومجربة من قبل ساره، مو وصفات مترجمة من الإنترنت.",
  },
  {
    question: "كيف ألغي الاشتراك؟",
    answer:
      "بضغطة من إعدادات حسابك. بدون اتصالات، بدون أسئلة، بدون استبيانات. لو ألغيتي خلال أول 14 يوم، نرد لك المبلغ كاملاً.",
  },
  {
    question: "هل بياناتي الصحية آمنة؟",
    answer:
      "نعم. كل بياناتك مشفّرة بتشفير AES-256، ومخزنة على خوادم متوافقة مع نظام حماية البيانات الشخصية السعودي و GDPR. ما نشاركها مع أي طرف ثالث، وتقدرين تحذفينها كاملة في أي وقت.",
  },
  {
    question: "هل التطبيق يدعم لغات غير العربية؟",
    answer:
      "نعم. يدعم 7 لغات حالياً: العربية، الإنجليزية، الفلبينية (تاغالوغ)، الإندونيسية، البنغالية، الإثيوبية (الأمهرية)، والأوردو. كل فرد في عائلتك يختار لغته.",
  },
  {
    question: "هل يمكنني تجربته قبل الدفع؟",
    answer:
      "نعم. أول 7 أيام مجانية، بدون الحاجة لبطاقة ائتمان. بعد التجربة، تختارين الباقة المناسبة، ولو ما عجبكِ خلال 14 يوم نرد المبلغ كاملاً.",
  },
];

const MotionAccordionItem = motion.create(AccordionItem);

export default function FAQ() {
  const reduced = useReducedMotion() ?? false;

  const topRef = useRef<HTMLDivElement | null>(null);
  const topInView = useInView(topRef, { amount: 0.3, once: true });

  const listRef = useRef<HTMLDivElement | null>(null);
  const listInView = useInView(listRef, { amount: 0.2, once: true });

  const topFade = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 15 },
    animate:
      reduced || topInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.4, ease: "easeOut" as const, delay },
  });

  const whatsappDelay = 0.96;

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-24 bg-surface py-16 lg:py-24"
    >
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          <header
            ref={topRef}
            className="mb-12 flex flex-col items-center gap-3 text-center"
          >
            <motion.span
              {...topFade(0)}
              className="text-sm font-semibold text-primary"
            >
              أسئلة قبل ما تشتركين
            </motion.span>
            <motion.h2
              id="faq-title"
              {...topFade(0.1)}
              className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
            >
              كل اللي يدور في بالك — نجاوبه هنا.
            </motion.h2>
          </header>

          <div ref={listRef}>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <MotionAccordionItem
                  key={i}
                  value={`faq-${i}`}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={
                    reduced || listInView
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 8 }
                  }
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: 0.3,
                          ease: "easeOut" as const,
                          delay: i * 0.06,
                        }
                  }
                  className="group/item relative border-b border-ink/10 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-0 top-0 bottom-0 w-[3px] origin-top scale-x-0 bg-brand-yellow opacity-0 transition-all duration-200 ease-out motion-reduce:duration-100 group-data-[state=open]/item:scale-x-100 group-data-[state=open]/item:opacity-100"
                  />
                  <AccordionTrigger
                    className="min-h-11 px-4 py-6 text-base font-bold leading-snug text-ink no-underline transition-colors duration-150 ease-out hover:bg-ink/[0.03] hover:no-underline aria-expanded:text-brand-purple-700 md:text-lg [&_[data-slot=accordion-trigger-icon]]:text-ink-muted aria-expanded:[&_[data-slot=accordion-trigger-icon]]:text-brand-purple-700"
                  >
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-6 pt-0 text-base leading-[1.8] text-ink-muted">
                    {faq.answer}
                  </AccordionContent>
                </MotionAccordionItem>
              ))}
            </Accordion>
          </div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={
              reduced || listInView
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 8 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.4,
                    ease: "easeOut" as const,
                    delay: whatsappDelay,
                  }
            }
            className="mt-12 flex flex-row flex-wrap items-center justify-center gap-2 text-center"
          >
            <MessageCircle
              className="size-4 shrink-0 text-[#25D366]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="text-base text-ink-muted">ما لقيتي إجابة؟</span>
            <a
              href="https://wa.me/966XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold text-[#25D366] transition-all hover:underline"
            >
              كلمينا على واتساب
            </a>
            <span className="text-base text-ink-muted">
              — نرد خلال ساعة.
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
