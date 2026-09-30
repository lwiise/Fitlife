import { ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import type { OvDelta } from "./model";

/**
 * A period-over-period change (`.ad-delta`, the prototype's deltaPill): green
 * when the move is good for the business, red when it is bad (rising churn or
 * AI cost), neutral when flat. The pill shows the arrow and the percentage;
 * screen readers get the whole comparison instead, prior value included.
 * `vs` adds the visible «مقابل الفترة السابقة» (the cost tile's variant).
 */
export function DeltaPill({ delta, vs }: { delta: OvDelta; vs?: string }) {
  const Icon = delta.dir === "up" ? ChevronUp : delta.dir === "down" ? ChevronDown : null;
  return (
    <span className={clsx("ad-delta", `ad-${delta.tone}`)} title={delta.label}>
      {Icon ? <Icon className="ad-ic" aria-hidden="true" /> : null}
      <span aria-hidden="true">{delta.text}</span>
      {vs ? (
        <span className="ad-vs" aria-hidden="true">
          {vs}
        </span>
      ) : null}
      <span className="ad-sr">{delta.label}</span>
    </span>
  );
}
