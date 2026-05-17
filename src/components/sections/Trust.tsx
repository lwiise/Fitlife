"use client";

import {
  Award,
  BadgeCheck,
  GraduationCap,
  MessageSquare,
  Shield,
  Stethoscope,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";

type TrustCard = {
  Icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  hoverBorderClass: string;
  title: string;
  description: string;
};

const trustCards: TrustCard[] = [
  {
    Icon: Shield,
    iconBgClass: "bg-emerald-500/[0.12]",
    iconColorClass: "text-emerald-600",
    hoverBorderClass: "hover:border-emerald-500/25",
    title: "TRUST_CARD_1_TITLE",
    description: "TRUST_CARD_1_DESCRIPTION",
  },
  {
    Icon: BadgeCheck,
    iconBgClass: "bg-primary/[0.12]",
    iconColorClass: "text-primary",
    hoverBorderClass: "hover:border-primary/25",
    title: "TRUST_CARD_2_TITLE",
    description: "TRUST_CARD_2_DESCRIPTION",
  },
  {
    Icon: Trash2,
    iconBgClass: "bg-brand-pink/[0.12]",
    iconColorClass: "text-brand-pink",
    hoverBorderClass: "hover:border-brand-pink/25",
    title: "TRUST_CARD_3_TITLE",
    description: "TRUST_CARD_3_DESCRIPTION",
  },
  {
    Icon: MessageSquare,
    iconBgClass: "bg-brand-yellow/[0.18]",
    iconColorClass: "text-[#B8870B]",
    hoverBorderClass: "hover:border-brand-yellow/25",
    title: "TRUST_CARD_4_TITLE",
    description: "TRUST_CARD_4_DESCRIPTION",
  },
];

const credentials: { Icon: LucideIcon; label: string }[] = [
  { Icon: GraduationCap, label: "CREDENTIAL_1_PLACEHOLDER" },
  { Icon: Award, label: "CREDENTIAL_2_PLACEHOLDER" },
  { Icon: Stethoscope, label: "CREDENTIAL_3_PLACEHOLDER" },
];

const compliance = [
  "COMPLIANCE_PLACEHOLDER_1",
  "COMPLIANCE_PLACEHOLDER_2",
  "COMPLIANCE_PLACEHOLDER_3",
  "COMPLIANCE_PLACEHOLDER_4",
];

export default function Trust() {
  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="relative scroll-mt-24 bg-surface-elevated py-16 lg:py-24"
    >
      <div className="container-page">
        <header className="mx-auto mb-16 flex max-w-[700px] flex-col items-center gap-3 text-center">
          <span className="text-sm font-semibold text-primary">
            TRUST_EYEBROW_PLACEHOLDER
          </span>
          <h2
            id="trust-title"
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            TRUST_HEADLINE_PLACEHOLDER
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10 lg:grid-cols-5 lg:gap-16">
          <div className="md:col-span-7 lg:col-span-3">
            <div className="relative aspect-[3/4] w-full max-w-[480px]">
              <div
                aria-hidden="true"
                className="absolute top-2 end-2 h-full w-full rotate-[1.5deg] rounded-2xl bg-brand-yellow/20"
              />
              {/* TODO: Replace /sara-portrait.svg with real photograph of Sara before launch */}
              <Image
                src="/sara-portrait.svg"
                alt="Sara portrait"
                width={480}
                height={640}
                unoptimized
                className="relative h-full w-full -rotate-[1.5deg] rounded-2xl object-cover shadow-xl shadow-primary/20"
              />
            </div>

            <div className="mt-12">
              <h3 className="text-[28px] font-extrabold leading-tight text-ink">
                FOUNDER_NAME_PLACEHOLDER
              </h3>
              <p className="mt-1 text-base font-semibold text-primary">
                FOUNDER_TITLE_PLACEHOLDER
              </p>
              <p className="mt-4 max-w-[50ch] text-base leading-[1.7] text-ink-muted">
                FOUNDER_BIO_PLACEHOLDER
              </p>

              <ul className="mt-6 flex flex-row flex-wrap gap-x-6 gap-y-3">
                {credentials.map(({ Icon, label }, i) => (
                  <li key={i} className="flex flex-row items-start gap-2">
                    <Icon
                      className="mt-0.5 size-[18px] shrink-0 text-brand-purple-700"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-[13px] font-medium leading-[1.4] text-ink-muted">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:col-span-5 lg:col-span-2">
            {trustCards.map(
              (
                {
                  Icon,
                  iconBgClass,
                  iconColorClass,
                  hoverBorderClass,
                  title,
                  description,
                },
                i,
              ) => (
                <article
                  key={i}
                  className={`flex flex-row items-start gap-4 rounded-xl border border-ink/[0.08] bg-surface p-5 transition-colors duration-200 ${hoverBorderClass}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
                  >
                    <Icon
                      className={`size-5 ${iconColorClass}`}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-snug text-ink">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-[1.6] text-ink-muted">
                      {description}
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>

        <div className="mt-20 flex flex-row flex-wrap items-center justify-center gap-3 text-[13px] font-medium tracking-wider text-ink-muted opacity-50">
          {compliance.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && <span aria-hidden="true">•</span>}
              <span>{item}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
