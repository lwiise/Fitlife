import Link from "next/link";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { buildQuery } from "./searchParams";

/**
 * SAR | USD display-currency toggle for cost figures (zero JS, URL-param
 * driven). SAR is the default and omits the param for a clean URL. Lives in the
 * "Cost & efficiency" header because revenue is always SAR — only the
 * USD-billed AI cost figures (strip + table column) switch.
 */
export function CurrencyToggle({
  currency,
  baseParams,
  locale,
}: {
  currency: Currency;
  baseParams: Record<string, string>;
  locale: AdminLocale;
}) {
  const opts: Array<{ key: Currency; label: string; cur?: string }> = [
    { key: "sar", label: t("currency_label", locale) },
    { key: "usd", label: t("currency_usd_label", locale), cur: "usd" },
  ];

  return (
    <div
      role="group"
      aria-label={t("currency_group_label", locale)}
      className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
    >
      {opts.map((o) => {
        const active = o.key === currency;
        return (
          <Link
            key={o.key}
            href={buildQuery(baseParams, { cur: o.cur })}
            aria-current={active ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
