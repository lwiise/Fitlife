import { Pill } from "../_ui/Pill";
import { Ltr } from "../_ui/Text";
import type { OvEngagement } from "./model";

/**
 * «طبقة التفاعل» (prototype engageTiles): the engagement loop's last-7-days
 * counters and the renewal proxy. Without migration 00017 the counters are
 * zeros rather than activity, and a badge says so.
 */
export function EngagementTiles({ engagement }: { engagement: OvEngagement }) {
  const { missing } = engagement;
  return (
    <section className="ad-stack" aria-labelledby="ad-ov-engage-title">
      <div className="ad-ov-titlerow">
        <h2 id="ad-ov-engage-title" className="ad-sec-title">
          {engagement.title}
        </h2>
        {missing ? (
          <Pill tone="warn">
            <span>
              {missing.before}
              <Ltr>{missing.code}</Ltr>
              {missing.after}
            </span>
          </Pill>
        ) : null}
      </div>
      {engagement.unavailable ? <p className="ad-sub">{engagement.unavailable}</p> : null}
      <div className="ad-tiles ad-c6">
        {engagement.tiles.map((tile) => (
          <div key={tile.key} className="ad-tile">
            <span className="ad-lb">{tile.label}</span>
            <span className="ad-v ad-num">{tile.value}</span>
            {tile.hint ? <span className="ad-h">{tile.hint}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
