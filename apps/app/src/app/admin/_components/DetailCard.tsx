import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A titled section card. `titleAs` sets the heading level so cards nest under
 * their section heading (h2 by default; h3 when inside an h2 section). `icon`
 * adds a small leading glyph so a long stack of cards stays scannable. */
export function DetailCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  titleAs: Heading = "h2",
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border border-brand-ink/10 bg-surface-elevated shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 border-b border-brand-ink/10 bg-brand-purple-900/[0.04] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-purple-900/10 text-brand-purple-900"
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <Heading className="adm-h2 truncate text-brand-ink">{title}</Heading>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
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
      <dt className="adm-label text-brand-ink-muted">{label}</dt>
      <dd
        className={`adm-body text-brand-ink ${mono ? "tabular-nums" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
