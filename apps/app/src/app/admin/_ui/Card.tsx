import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type BlockTag = "div" | "section" | "article" | "aside";

/** A bordered card on the card surface (`.ad-card`). */
export function Card({
  as: Tag = "div",
  className,
  children,
  ...aria
}: {
  as?: BlockTag;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={clsx("ad-card", className)} {...aria}>
      {children}
    </Tag>
  );
}

/** A padded card with a 16px vertical rhythm (`.ad-card.ad-panel`). */
export function Panel({
  as: Tag = "section",
  className,
  children,
  ...aria
}: {
  as?: BlockTag;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={clsx("ad-card ad-panel", className)} {...aria}>
      {children}
    </Tag>
  );
}

/** A panel's header row: a title at the start, an optional action at the end. */
export function PanelHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="ad-panel-h">
      {children}
      {action}
    </div>
  );
}

/** A section title (`.ad-sec-title`), optionally led by a purple icon. */
export function SecTitle({
  as: Tag = "h3",
  icon: Icon,
  id,
  className,
  children,
}: {
  as?: "h2" | "h3" | "h4";
  icon?: LucideIcon;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={clsx("ad-sec-title", className)}>
      {Icon ? <Icon className="ad-ic" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

/** A small muted label (`.ad-label`); uppercase + tracked in English only. */
export function Label({
  as: Tag = "p",
  id,
  className,
  children,
}: {
  as?: "p" | "h2" | "h3" | "h4" | "span";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={clsx("ad-label", className)}>
      {children}
    </Tag>
  );
}

/** A tinted inner box (`.ad-box`). */
export function Box({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("ad-box", className)}>{children}</div>;
}

/** The box's top line: a state at the start, a muted note at the end. */
export function BoxTop({ children }: { children: ReactNode }) {
  return <div className="ad-box-top">{children}</div>;
}
