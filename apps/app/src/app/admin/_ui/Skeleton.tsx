import type { ReactNode } from "react";
import { clsx } from "clsx";

export type SkeletonShape =
  | "line"
  | "text"
  | "title"
  | "pill"
  | "btn"
  | "circle"
  | "row"
  | "tile"
  | "block"
  | "chart";

/**
 * A placeholder block (`.ad-skel`) — a soft pulse that stops under reduced
 * motion. `width` is a percentage of the parent (0–100, via `.ad-wN`).
 */
export function Skeleton({
  shape = "line",
  width,
  className,
}: {
  shape?: SkeletonShape;
  width?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "ad-skel",
        shape !== "line" && `ad-skel-${shape}`,
        width != null && `ad-w${Math.round(Math.min(100, Math.max(0, width)))}`,
        className,
      )}
    />
  );
}

/** Wraps skeletons with a screen-reader status so a loading region is
 * announced once, not as a pile of empty shapes. */
export function SkeletonGroup({
  label,
  className,
  children,
}: {
  /** e.g. «جارٍ التحميل». */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={clsx("ad-skel-group", className)}>
      <span className="ad-sr">{label}</span>
      {children}
    </div>
  );
}
