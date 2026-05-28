import { Check } from "lucide-react";
import { PRICING_TIERS } from "@fitlife/config";
import type { SubscriptionRow } from "@/lib/subscription/state";

const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return "";
  }
}

const STATUS_BADGE: Record<
  string,
  { label: string; classes: string }
> = {
  active: { label: "نشط", classes: "bg-brand-emerald/10 text-brand-emerald" },
  trialing: { label: "تجريبي", classes: "bg-brand-yellow/20 text-brand-ink" },
  past_due: { label: "متأخر الدفع", classes: "bg-red-100 text-red-700" },
  cancelled: { label: "ملغى", classes: "bg-brand-ink/10 text-brand-ink-muted" },
  expired: { label: "منتهي", classes: "bg-brand-ink/10 text-brand-ink-muted" },
};

export function CurrentPlanCard({
  sub,
  children,
}: {
  sub: SubscriptionRow;
  /** Card-on-file line, streamed from LS via Suspense. */
  children?: React.ReactNode;
}) {
  const tier = PRICING_TIERS[sub.tier];
  const isAnnual = sub.cadence === "annual";
  const price = isAnnual ? tier.price_annual_sar : tier.price_monthly_sar;
  const badge = STATUS_BADGE[sub.status] ?? STATUS_BADGE.expired!;

  return (
    <section className="bg-white rounded-3xl border border-brand-ink/5 p-6 md:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
            {tier.name_ar}
          </h2>
          <p className="mt-1 text-brand-ink-muted text-sm">
            {sub.cadence === "annual" ? "سنوي" : "شهري"} ·{" "}
            <span className="tabular-nums">{price}</span> ر.س
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold flex-shrink-0 ${badge.classes}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Renewal / status line */}
      <div className="mt-4">
        {sub.status === "past_due" ? (
          <p className="text-red-700 text-sm font-bold leading-relaxed">
            فيه مشكلة في تجديد اشتراكك
          </p>
        ) : sub.cancel_at_period_end ? (
          <p className="text-brand-warm-orange text-sm font-bold leading-relaxed">
            ينتهي اشتراكك في {fmtDate(sub.current_period_end)}
          </p>
        ) : sub.status === "trialing" ? (
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            تنتهي تجربتك في {fmtDate(sub.trial_ends_at)}
          </p>
        ) : sub.current_period_end ? (
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            التجديد القادم: {fmtDate(sub.current_period_end)}
          </p>
        ) : null}
        {children}
      </div>

      {/* What's included */}
      <ul className="mt-5 space-y-2 border-t border-brand-ink/5 pt-5">
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
    </section>
  );
}
