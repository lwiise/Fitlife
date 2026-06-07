import type { ReactNode } from "react";

/** A titled section card. `titleAs` sets the heading level so cards nest under
 * their section heading (h2 by default; h3 when inside an h2 section). */
export function DetailCard({
  title,
  action,
  children,
  className,
  titleAs: Heading = "h2",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border border-brand-ink/10 bg-surface-elevated"
    >
      <header className="flex items-center justify-between gap-3 border-b border-brand-ink/10 px-4 py-3">
        <Heading className="text-sm font-bold text-brand-ink">{title}</Heading>
        {action}
      </header>
      <div className={`p-4 ${className ?? ""}`}>{children}</div>
    </section>
  );
}

/** A label/value pair. Use inside a <dl>. `mono` right-isolates IDs/dates LTR. */
export function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-xs text-brand-ink-muted">{label}</dt>
      <dd
        className={`text-sm text-brand-ink ${mono ? "tabular-nums" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
