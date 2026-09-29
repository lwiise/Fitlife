import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

/** The six tones shared by pills, flags, dots, notes and reasons. */
export type Tone = "ok" | "warn" | "crit" | "neu" | "pur" | "info";

const TONE_CLASS: Record<Tone, string> = {
  ok: "ad-ok",
  warn: "ad-warn",
  crit: "ad-crit",
  neu: "ad-neu",
  pur: "ad-pur",
  info: "ad-info",
};

/** CSS class for a tone (`"ok"` → `"ad-ok"`). */
export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

/**
 * A rounded status pill with a leading dot (`.ad-pill`). `plain` drops the dot
 * — use it for kinds/labels that are not a state (e.g. «وجبات», «مشتركة»).
 */
export function Pill({
  tone,
  plain,
  title,
  className,
  children,
}: {
  tone: Tone;
  plain?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={clsx("ad-pill", TONE_CLASS[tone], plain && "ad-plain", className)}
    >
      {children}
    </span>
  );
}

/** A square-cornered flag chip (`.ad-flag`) — attention reasons, row flags. */
export function Flag({
  tone,
  icon: Icon,
  title,
  className,
  children,
}: {
  tone: Tone;
  icon?: LucideIcon;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={clsx("ad-flag", TONE_CLASS[tone], className)}>
      {Icon ? <Icon className="ad-ic" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** An 8px colour dot (`.ad-dot`) — purely decorative. */
export function Dot({ tone = "neu", className }: { tone?: Tone; className?: string }) {
  return <span aria-hidden="true" className={clsx("ad-dot", TONE_CLASS[tone], className)} />;
}
