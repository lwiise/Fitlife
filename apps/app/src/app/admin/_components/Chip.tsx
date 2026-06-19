import type { ReactNode } from "react";

type Tone = "danger" | "warn" | "ok" | "neutral";

const TONE: Record<Tone, string> = {
  danger: "bg-red-600/10 text-red-700",
  warn: "bg-brand-warm-orange/12 text-brand-ink",
  ok: "bg-brand-emerald/12 text-brand-emerald",
  neutral: "bg-brand-ink/8 text-brand-ink-muted",
};

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
