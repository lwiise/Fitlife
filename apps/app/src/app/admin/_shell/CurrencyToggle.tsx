"use client";

import { useFormStatus } from "react-dom";
import type { Currency } from "@/lib/admin/format";
import { setAdminCurrency } from "../actions";
import type { ShellLabels } from "./labels";
import { SCRIPTED_FIELD } from "./toggleReturn";
import { markScripted, useReturnPath } from "./useReturnPath";

type Labels = Pick<ShellLabels, "currency" | "sar" | "usd">;

/**
 * SAR | USD display-currency switch around the setAdminCurrency server
 * action. Global: every money value in the console honours it. Return path
 * and pending state as in LocaleToggle.
 */
export function CurrencyToggle({ currency, labels }: { currency: Currency; labels: Labels }) {
  const next = useReturnPath();
  return (
    <form action={setAdminCurrency} onSubmit={markScripted}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name={SCRIPTED_FIELD} defaultValue="" />
      <Options currency={currency} labels={labels} />
    </form>
  );
}

function Options({ currency, labels }: { currency: Currency; labels: Labels }) {
  const { pending, data } = useFormStatus();
  const shown: Currency = pending && data ? (data.get("currency") === "usd" ? "usd" : "sar") : currency;
  return (
    <div className="ad-seg" role="group" aria-label={labels.currency} aria-busy={pending || undefined}>
      <button type="submit" name="currency" value="sar" aria-pressed={shown === "sar"}>
        {labels.sar}
      </button>
      <button type="submit" name="currency" value="usd" aria-pressed={shown === "usd"}>
        {labels.usd}
      </button>
    </div>
  );
}
