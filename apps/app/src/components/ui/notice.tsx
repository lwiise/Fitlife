import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export type NoticeTone = "info" | "progress" | "success" | "warning" | "critical";

const TONE: Record<NoticeTone, { box: string; icon: ReactNode }> = {
  info: {
    box: "bg-brand-tint text-brand-ink",
    icon: <Info className="size-5 text-brand-purple-900" aria-hidden="true" />,
  },
  progress: {
    box: "bg-brand-tint text-brand-ink",
    icon: (
      <Loader2
        className="size-5 animate-spin text-brand-purple-900 motion-reduce:animate-none"
        aria-hidden="true"
      />
    ),
  },
  success: {
    box: "bg-success-soft text-brand-ink",
    icon: <CheckCircle2 className="size-5 text-success" aria-hidden="true" />,
  },
  warning: {
    box: "bg-warning-soft text-brand-ink",
    icon: <AlertTriangle className="size-5 text-warning" aria-hidden="true" />,
  },
  critical: {
    box: "border border-critical/25 bg-critical-soft text-brand-ink",
    icon: <XCircle className="size-5 text-critical" aria-hidden="true" />,
  },
};

/**
 * One notice, one tone. Tones differ in COLOUR AND ICON, so a failure never
 * reads like a tip (every notice used to be the same lavender box).
 * Screens show at most one at a time — callers pick by priority.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  const live = tone === "critical" || tone === "warning" ? "alert" : "status";
  return (
    <div
      role={live}
      className={clsx(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl px-4 py-3.5",
        t.box,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1 basis-56">
        {title && <p className="text-[15px] font-extrabold leading-snug">{title}</p>}
        {children && (
          <div className={clsx("text-[15px] leading-relaxed", title && "mt-0.5 text-brand-ink-muted")}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
