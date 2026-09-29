import { clsx } from "clsx";

/** `.ad-w0` … `.ad-w100` for a 0–1 fraction (clamped, rounded to a percent). */
export function widthClass(fraction: number): string {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return `ad-w${Math.round(f * 100)}`;
}

/**
 * A thin progress bar. `size="mini"` is the 40px list-cell meter, `md` the
 * 64px day-total meter. Decorative by default (the number sits beside it);
 * give it a `label` when it stands alone.
 */
export function Meter({
  value,
  tone = "ok",
  size = "md",
  label,
  className,
}: {
  /** 0–1. */
  value: number;
  tone?: "ok" | "pur" | "warn" | "crit";
  size?: "md" | "mini";
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(size === "mini" ? "ad-mini-meter" : "ad-meter", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <i className={clsx(widthClass(value), tone !== "ok" && `ad-${tone}`)} />
    </span>
  );
}
