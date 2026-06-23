import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { setAdminCurrency } from "../actions";

/**
 * SAR | USD display-currency switch — a zero-JS form whose server action sets
 * the `admin_currency` cookie and returns to `next` (mirrors LocaleToggle). The
 * choice is global: every money value across the admin honors it, so this lives
 * in the header beside the language switch rather than on a single section.
 */
export function CurrencyToggle({
  currency,
  next,
  locale,
}: {
  currency: Currency;
  next: string;
  locale: AdminLocale;
}) {
  const options: Array<{ value: Currency; label: string }> = [
    { value: "sar", label: t("currency_label", locale) },
    { value: "usd", label: t("currency_usd_label", locale) },
  ];
  return (
    <form
      action={setAdminCurrency}
      aria-label={t("currency_group_label", locale)}
      className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
    >
      <input type="hidden" name="next" value={next} />
      {options.map((o) => {
        const active = o.value === currency;
        return (
          <button
            key={o.value}
            type="submit"
            name="currency"
            value={o.value}
            aria-pressed={active}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </form>
  );
}
