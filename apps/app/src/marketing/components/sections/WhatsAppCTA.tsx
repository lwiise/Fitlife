"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { track } from "@/marketing/lib/analytics";

interface WhatsAppCTAProps {
  phoneNumber?: string;
  responseTime?: string;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

const settleEase = [0.16, 1, 0.3, 1] as const;

export default function WhatsAppCTA({
  phoneNumber = "966XXXXXXXXX",
  responseTime = "23 دقيقة",
}: WhatsAppCTAProps = {}) {
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement | null>(null);
  const sectionInView = useInView(sectionRef, { amount: 0.4, once: true });
  const pulseInView = useInView(sectionRef, { amount: 0.2, once: false });

  const fadeIn = (delay: number, y = 10, duration = 0.3) => ({
    initial: reduced ? false : { opacity: 0, y },
    animate:
      reduced || sectionInView ? { opacity: 1, y: 0 } : { opacity: 0, y },
    transition: reduced
      ? { duration: 0 }
      : { duration, ease: "easeOut" as const, delay },
  });

  const pulseRunning = pulseInView && !reduced;

  return (
    <section
      ref={sectionRef}
      aria-label="تواصلي معنا عبر واتساب"
      className="bg-surface py-16"
    >
      <div className="container-page">
        <motion.div
          initial={
            reduced ? false : { opacity: 0, scale: 0.97, y: 20 }
          }
          animate={
            reduced || sectionInView
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.97, y: 20 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.6, ease: settleEase }
          }
          className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-[color-mix(in_oklch,#25D366_20%,transparent)] bg-gradient-to-b from-surface-elevated to-[color-mix(in_oklch,#25D366_5%,transparent)] p-8 text-center md:p-12"
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.8 }}
            animate={
              reduced || sectionInView
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.8 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.4,
                    ease: "easeOut" as const,
                    delay: 0.8,
                  }
            }
          >
            <motion.div
              animate={
                pulseRunning ? { scale: [1, 1.05, 1] } : { scale: 1 }
              }
              transition={
                pulseRunning
                  ? {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut" as const,
                    }
                  : { duration: 0 }
              }
            >
              <WhatsAppIcon className="size-14 text-[#25D366]" />
            </motion.div>
          </motion.div>

          <motion.h2
            {...fadeIn(0.88)}
            className="text-2xl font-extrabold leading-tight text-foreground md:text-[28px]"
          >
            عندك سؤال؟ كلمينا مباشرة.
          </motion.h2>

          <motion.p
            {...fadeIn(0.96)}
            className="max-w-[500px] text-base leading-[1.7] text-ink-muted md:text-lg"
          >
            ساره أو آمنة تردّ عليكِ بنفسها — مو بوت، مو فورم. ساعات العمل: 9 ص - 9 م (السبت إلى الخميس).
          </motion.p>

          <motion.a
            href={`https://wa.me/${phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("whatsapp_clicked", { source: "whatsapp_section" })
            }
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={
              reduced || sectionInView
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 10 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 0.3,
                    ease: "easeOut" as const,
                    delay: 1.04,
                  }
            }
            whileHover={
              reduced
                ? undefined
                : {
                    y: -2,
                    transition: { duration: 0.2, ease: "easeOut" as const },
                  }
            }
            whileTap={
              reduced ? undefined : { scale: 0.98, transition: { duration: 0.1 } }
            }
            className="mt-2 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#25D366] px-8 py-4 text-lg font-bold text-white shadow-md transition-[background-color,box-shadow] duration-200 ease-out hover:bg-[#2EE672] hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#25D366]/40"
          >
            <WhatsAppIcon className="size-5" />
            <span>ابدئي محادثة</span>
          </motion.a>

          <motion.span
            {...fadeIn(1.12)}
            className="mt-1 text-sm font-medium text-ink-muted"
          >
            متوسط وقت الرد: {responseTime}
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
