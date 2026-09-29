import type { ReactNode } from "react";

export interface Stat {
  /** Stable key (defaults to the index). */
  key?: string;
  value: ReactNode;
  label: ReactNode;
}

/** Three figures side by side with hairline separators (`.ad-stats3`). */
export function Stats3({ items }: { items: Stat[] }) {
  return (
    <div className="ad-stats3">
      {items.map((s, i) => (
        <div key={s.key ?? i}>
          <b className="ad-num">{s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
