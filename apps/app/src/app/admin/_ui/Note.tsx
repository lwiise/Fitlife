import type { ReactNode } from "react";
import { Info, Shield, TriangleAlert, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export type NoteTone = "neutral" | "info" | "warn" | "crit" | "audit";

const NOTE_CLASS: Record<NoteTone, string | null> = {
  neutral: null,
  info: "ad-info",
  warn: "ad-warn",
  crit: "ad-crit",
  audit: "ad-audit",
};

const NOTE_ICON: Record<NoteTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  warn: TriangleAlert,
  crit: TriangleAlert,
  audit: Shield,
};

/** An inline note with a leading icon (`.ad-note`). `icon={null}` hides it. */
export function Note({
  tone = "neutral",
  icon,
  role,
  className,
  children,
}: {
  tone?: NoteTone;
  icon?: LucideIcon | null;
  role?: "status" | "alert" | "note";
  className?: string;
  children: ReactNode;
}) {
  const Icon = icon === undefined ? NOTE_ICON[tone] : icon;
  return (
    <div role={role} className={clsx("ad-note", NOTE_CLASS[tone], className)}>
      {Icon ? <Icon className="ad-ic" aria-hidden="true" /> : null}
      <span>{children}</span>
    </div>
  );
}

/** An empty state (`.ad-empty`): a bold line, then a muted explanation. */
export function Empty({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ad-empty">
      {title ? <b>{title}</b> : null}
      {children}
    </div>
  );
}

/** The shield line under anything whose opening is recorded in the audit log. */
export function AuditLine({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={clsx("ad-audit-line", className)}>
      <Shield className="ad-ic" aria-hidden="true" />
      {children}
    </p>
  );
}
