import { Check } from "lucide-react";
import { PRICING_TIERS } from "@fitlife/config";
import type { SubscriptionRow } from "@/lib/subscription/state";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

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
  active: { label: "نشط", classes: "bg-success-soft text-success" },
  trialing: { label: "تجريبي", classes: "bg-warning-soft text-brand-ink" },
  past_due: { label: "متأخر الدفع", classes: "bg-critical-soft text-critical" },
  // «استراحة» — a deliberate, self-resuming pause, not an ending. Without this
  // key the lookup fell through to `expired` and badged a paused subscription
  // «منتهي», on the same page that renders the PausedNotice and the «عدتُ
  // مبكراً» resume button. (Unreachable until 00023 lets the status exist.)
  paused: { label: "استراحة", classes: "bg-warning-soft text-brand-ink" },
  cancelled: { label: "ملغى", classes: "bg-brand-tint text-brand-ink-muted" },
  expired: { label: "منتهي", classes: "bg-brand-tint text-brand-ink-muted" },
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
    <Card aria-labelledby="current-plan-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-meta text-brand-ink-muted">باقتك الحالية</p>
          <h2 id="current-plan-title" className="mt-0.5 text-2xl font-extrabold leading-tight text-brand-ink">
            {tier.name_ar}
          </h2>
          <p className="mt-1 text-[15px] text-brand-ink-muted">
            {sub.cadence === "annual" ? "سنوي" : "شهري"} ·{" "}
            <span className="tabular-nums">{price}</span> ر.س
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[13px] font-bold ${badge.classes}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Renewal / status line */}
      <div className="mt-4">
        {sub.status === "past_due" ? (
          <Notice tone="critical" title="تعذّر تجديد اشتراككم" />
        ) : sub.cancel_at_period_end ? (
          <Notice tone="warning" title={`ينتهي اشتراكك في ${fmtDate(sub.current_period_end)}`} />
        ) : sub.status === "trialing" ? (
          <p className="text-[15px] leading-relaxed text-brand-ink-muted">
            تنتهي تجربتك في {fmtDate(sub.trial_ends_at)}
          </p>
        ) : sub.current_period_end ? (
          <p className="text-[15px] leading-relaxed text-brand-ink-muted">
            التجديد القادم: {fmtDate(sub.current_period_end)}
          </p>
        ) : null}
        {children}
      </div>

      {/* What's included */}
      <ul className="mt-5 space-y-2 border-t border-brand-line pt-5">
        {tier.features_ar.map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[15px] leading-relaxed text-brand-ink"
          >
            <Check
              className="mt-1 size-4 shrink-0 text-success"
              aria-hidden="true"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
