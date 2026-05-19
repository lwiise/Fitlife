import { Check } from "lucide-react";
import {
  type TierDefinition,
  type Cadence,
  getAnnualMonthlyEquivalent,
} from "@fitlife/config";
import { ChooseTierButton } from "./ChooseTierButton";

export function TierCard({
  tier,
  cadence,
}: {
  tier: TierDefinition;
  cadence: Cadence;
}) {
  const isAnnual = cadence === "annual";
  const displayPrice = isAnnual
    ? getAnnualMonthlyEquivalent(tier)
    : tier.price_monthly_sar;
  const annualTotal = tier.price_annual_sar;

  const highlightClasses = tier.highlighted
    ? "border-brand-yellow bg-white shadow-2xl scale-100 md:scale-105"
    : "border-brand-ink/10 bg-white";

  return (
    <article
      className={`relative flex flex-col rounded-3xl border-2 p-6 md:p-8 transition-transform ${highlightClasses}`}
    >
      {tier.highlighted && (
        <span
          aria-hidden="true"
          className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 inline-flex items-center px-3 py-1 rounded-full bg-brand-ink text-white text-xs font-bold"
        >
          الأكثر شعبية
        </span>
      )}

      <header>
        <h3 className="font-extrabold text-2xl text-brand-ink leading-tight">
          {tier.name_ar}
        </h3>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-extrabold text-4xl text-brand-ink tabular-nums">
            {displayPrice}
          </span>
          <span className="text-brand-ink-muted text-sm">ر.س / شهر</span>
        </div>
        {isAnnual && (
          <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed">
            يُحتسب {annualTotal} ر.س سنوياً
          </p>
        )}
      </header>

      <ul className="mt-6 space-y-2 flex-1">
        {tier.features_ar.map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-brand-ink text-sm leading-relaxed"
          >
            <Check
              className="size-4 flex-shrink-0 mt-0.5 text-brand-emerald"
              aria-hidden="true"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <ChooseTierButton tierName={tier.name_ar} />
    </article>
  );
}
