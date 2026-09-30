import { Info } from "lucide-react";
import { clsx } from "clsx";
import { joinSep } from "../_ui/Sep";
import type { OvCost } from "./model";
import { DeltaPill } from "./DeltaPill";
import { Sparkline } from "./Sparkline";

/**
 * «التكلفة والكفاءة» (prototype costTiles): the range's total AI spend with
 * its per-bucket sparkline and change — a rise is bad — then four averages.
 * Every figure is billed in USD and shown in the operator's currency; the
 * footnote says how they are computed.
 */
export function CostTiles({
  cost,
  vsPrior,
  rtl,
}: {
  cost: OvCost;
  /** «مقابل الفترة السابقة», shown inside the total's delta pill. */
  vsPrior: string;
  rtl: boolean;
}) {
  const { total } = cost;
  return (
    <section className="ad-stack" aria-labelledby="ad-ov-cost-title">
      <div className="ad-ovhead">
        <h2 id="ad-ov-cost-title" className="ad-sec-title">
          {cost.title}
        </h2>
        <span className="ad-sub">{cost.range}</span>
      </div>
      <div className="ad-tiles ad-c6">
        <div className="ad-tile ad-big">
          <div className="ad-tb">
            <span className="ad-lb">{total.label}</span>
            <span className={clsx("ad-v ad-num", total.long && "ad-ov-long")}>{total.value}</span>
            {total.delta ? <DeltaPill delta={total.delta} vs={vsPrior} /> : <span />}
          </div>
          <Sparkline values={total.spark} rtl={rtl} />
        </div>
        {cost.tiles.map((tile) => (
          <div key={tile.key} className="ad-tile">
            <span className="ad-lb">{tile.label}</span>
            <span className="ad-v ad-num">{tile.value}</span>
            <span className="ad-h">{tile.hint}</span>
          </div>
        ))}
      </div>
      <p className="ad-ov-foot">
        <Info className="ad-ic" aria-hidden="true" />
        {/* One flex item, so the sentences wrap as one paragraph. */}
        <span>{joinSep(...cost.notes)}</span>
      </p>
    </section>
  );
}
