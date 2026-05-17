"use client";

import { Check, Shield, Unlock, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Tier = {
  name: string;
  price: number;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
};

const tiers: Tier[] = [
  {
    name: "TIER_1",
    price: 0,
    description: "DESCRIPTION_PLACEHOLDER",
    features: Array.from({ length: 5 }, () => "FEATURE_PLACEHOLDER"),
    highlighted: false,
  },
  {
    name: "TIER_2",
    price: 0,
    description: "DESCRIPTION_PLACEHOLDER",
    features: Array.from({ length: 5 }, () => "FEATURE_PLACEHOLDER"),
    highlighted: false,
  },
  {
    name: "TIER_3",
    price: 0,
    description: "DESCRIPTION_PLACEHOLDER",
    features: Array.from({ length: 6 }, () => "FEATURE_PLACEHOLDER"),
    highlighted: true,
    badge: "BADGE_PLACEHOLDER",
  },
  {
    name: "TIER_4",
    price: 0,
    description: "DESCRIPTION_PLACEHOLDER",
    features: Array.from({ length: 4 }, () => "FEATURE_PLACEHOLDER"),
    highlighted: false,
  },
];

const trustItems = [
  { Icon: Shield, label: "TRUST_ITEM_1" },
  { Icon: X, label: "TRUST_ITEM_2" },
  { Icon: Unlock, label: "TRUST_ITEM_3" },
];

function PricingCard({ tier }: { tier: Tier }) {
  const { name, price, description, features, highlighted, badge } = tier;

  const cardBase =
    "relative flex h-full flex-col rounded-2xl p-8 transition-transform duration-200 ease-out";
  const cardSkin = highlighted
    ? "bg-primary border border-white/10 shadow-2xl shadow-brand-yellow/15 z-10 lg:scale-[1.02]"
    : "bg-surface-elevated border border-ink/10";

  const tierLabelClass = highlighted
    ? "text-brand-yellow"
    : "text-brand-purple-700";
  const priceClass = highlighted ? "text-white" : "text-ink";
  const periodClass = highlighted ? "text-brand-lavender" : "text-ink-muted";
  const descriptionClass = highlighted
    ? "text-brand-lavender"
    : "text-ink-muted";
  const dividerClass = highlighted ? "bg-white/15" : "bg-ink/10";
  const checkClass = highlighted ? "text-brand-yellow" : "text-emerald-600";
  const featureTextClass = highlighted ? "text-white" : "text-ink";

  return (
    <article className={`${cardBase} ${cardSkin}`}>
      {badge && (
        <span className="absolute top-0 inset-x-0 mx-auto w-fit -translate-y-1/2 rounded-full bg-brand-yellow px-4 py-1.5 text-xs font-bold uppercase text-primary">
          {badge}
        </span>
      )}

      <span
        className={`text-sm font-bold uppercase ${tierLabelClass}`}
        aria-label={name}
      >
        {name}
      </span>

      <div className="mt-4 flex flex-row items-baseline gap-2">
        <span
          className={`text-5xl font-extrabold tabular-nums leading-none ${priceClass}`}
        >
          {price}
        </span>
        <span className={`text-2xl font-semibold ${priceClass}`}>ر.س</span>
      </div>
      <p className={`mt-1 text-sm font-medium ${periodClass}`}>شهرياً</p>

      <p className={`mt-3 text-sm leading-[1.5] ${descriptionClass}`}>
        {description}
      </p>

      <div className={`mt-6 h-px ${dividerClass}`} aria-hidden="true" />

      <ul className="mt-6 flex flex-col gap-3">
        {features.map((feature, i) => (
          <li
            key={i}
            className="flex flex-row items-start gap-3"
          >
            <Check
              className={`mt-0.5 size-[18px] shrink-0 ${checkClass}`}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <span className={`text-sm leading-[1.5] ${featureTextClass}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-2">
        {highlighted ? (
          <Button
            size="lg"
            className="w-full min-h-11 bg-brand-yellow font-bold text-primary shadow-none hover:bg-brand-yellow hover:brightness-110"
          >
            CTA_PLACEHOLDER
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="w-full min-h-11 border-primary bg-transparent font-semibold text-primary hover:bg-primary/5"
          >
            CTA_PLACEHOLDER
          </Button>
        )}
      </div>
    </article>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="relative overflow-hidden bg-surface py-16 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklch,_var(--brand-lavender)_8%,_transparent)_0%,_transparent_60%)]"
      />

      <div className="container-page relative">
        <header className="mx-auto flex max-w-[600px] flex-col items-center gap-3 text-center">
          <span className="text-sm font-semibold text-primary">
            PRICING_EYEBROW_PLACEHOLDER
          </span>
          <h2
            id="pricing-title"
            className="text-balance text-[clamp(2rem,5vw,2.5rem)] font-bold leading-[1.2] text-foreground"
          >
            PRICING_HEADLINE_PLACEHOLDER
          </h2>
          <p className="max-w-[600px] text-base leading-[1.7] text-ink-muted">
            PRICING_SUBCOPY_PLACEHOLDER
          </p>

          <div className="mt-8 flex flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`min-h-11 px-1 text-sm font-medium transition-colors ${
                billing === "monthly" ? "text-ink" : "text-ink-muted"
              }`}
            >
              شهري
            </button>
            <span className="inline-flex min-h-11 min-w-11 items-center justify-center">
              <Switch
                checked={billing === "yearly"}
                onCheckedChange={(checked) =>
                  setBilling(checked ? "yearly" : "monthly")
                }
                aria-label="billing period"
              />
            </span>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`min-h-11 px-1 text-sm font-medium transition-colors ${
                billing === "yearly" ? "text-ink" : "text-ink-muted"
              }`}
            >
              سنوي (وفّر 20%)
            </button>
          </div>
        </header>

        <div className="mt-16 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>

        <ul className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-8">
          {trustItems.map(({ Icon, label }) => (
            <li
              key={label}
              className="flex flex-row items-center gap-2 text-sm font-medium text-ink-muted"
            >
              <Icon
                className="size-4 shrink-0 text-ink-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-sm font-medium text-ink-muted">
          PAYMENT_METHODS_PLACEHOLDER
        </p>
      </div>
    </section>
  );
}
