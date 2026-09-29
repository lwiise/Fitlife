"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { ReactNode, Ref } from "react";

// The /plan bar (concept «شريط الأسبوع», 09/2026): who the plan is for, the
// week's seven days, and the page's two secondary doors (recipes, •••). On
// phones it REPLACES the AppShell header — globals.css hides the shell header
// whenever a [data-plan-bar] is on the page — so it must be opaque and carry
// the page's identity itself. Compound pieces, composed by each viewer, rather
// than one component with a flag per variant.

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple-900";

/**
 * Sticky under the shell header on desktop, under the kitchen header on the
 * cook's view, at the very top on phones. Full-bleed on phones: it cancels
 * container-app's inline padding (1rem, 1.5rem from sm) so the bar meets both
 * screen edges like the header it replaces. `sticky` already makes it the
 * containing block for the progress rail.
 */
export function PlanBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      data-plan-bar=""
      className={clsx(
        "sticky top-[var(--plan-bar-offset,var(--app-header-h))] z-30 -mx-4 border-b border-brand-line bg-brand-card print:hidden sm:-mx-6 lg:mx-0 lg:mt-0 lg:rounded-2xl lg:border",
        className,
      )}
    >
      {children}
    </header>
  );
}

export function PlanBarRow({ children }: { children: ReactNode }) {
  return <div className="flex h-[52px] items-center gap-2 px-4">{children}</div>;
}

export function PlanBarEnd({ children }: { children: ReactNode }) {
  return <div className="ms-auto flex shrink-0 items-center gap-2">{children}</div>;
}

/**
 * Whose plan this is. With `onOpen` it is the member switcher's trigger (the
 * sheet is a dialog); without it — a solo plan — a plain label.
 *
 * The triggers take a `ref` so the viewer can hand it to the sheet they open
 * as its focus-return target: Safari (and Firefox on macOS) never focus a
 * tapped button, so "whatever was focused" would be <body> there.
 */
export function PlanBarIdentity({
  avatar,
  name,
  suffix,
  onOpen,
  expanded = false,
  openLabel,
  ref,
}: {
  /** <Avatar size="lg" …/> */
  avatar: ReactNode;
  name: string;
  /** «أنتِ» — rendered muted as «· أنتِ». */
  suffix?: string;
  onOpen?: () => void;
  expanded?: boolean;
  /** e.g. «خطة هند، تبديل الفرد». */
  openLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  const content = (
    <>
      {avatar}
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className={clsx("truncate text-app-item text-brand-ink")}>{name}</span>
        {suffix && (
          <span className="shrink-0 text-[15px] font-bold text-brand-ink-muted">· {suffix}</span>
        )}
      </span>
    </>
  );

  return (
    <div className="flex min-w-0 flex-1 items-center">
      {onOpen ? (
        <button
          ref={ref}
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-label={openLabel}
          className={clsx(
            "-ms-1 flex min-h-11 max-w-full items-center gap-2.5 rounded-full py-0.5 ps-0.5 pe-2 text-start transition-colors hover:bg-brand-surface motion-reduce:transition-none",
            FOCUS,
          )}
        >
          {content}
          <ChevronDown className="size-5 shrink-0 text-brand-ink-muted" aria-hidden="true" />
        </button>
      ) : (
        <div className="flex min-h-11 min-w-0 items-center gap-2.5">{content}</div>
      )}
    </div>
  );
}

/** The bar's one labelled door — «الوصفات». A link when it navigates; a
 * button when it opens a sheet, and then it says so (`expanded`). */
export function PlanBarPill({
  href,
  onClick,
  icon,
  children,
  ariaLabel,
  expanded = false,
  ref,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  /** Button form only: the sheet it opens is showing. */
  expanded?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  const className = clsx(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-tint px-3 text-[15px] font-bold text-brand-purple-900 transition-colors hover:bg-brand-lavender/40 motion-reduce:transition-none",
    FOCUS,
  );
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={ariaLabel}
      className={className}
    >
      {icon}
      {children}
    </button>
  );
}

/** The ••• trigger. `unread` adds a dot AND says so, since a dot alone is
 * invisible to a screen reader. */
export function PlanBarMore({
  onClick,
  expanded,
  unread = false,
  label = "المزيد",
  unreadLabel = "المزيد، مع تعديلات جديدة من سارة",
  ref,
}: {
  onClick: () => void;
  expanded: boolean;
  unread?: boolean;
  label?: string;
  unreadLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={unread ? unreadLabel : label}
      className={clsx(
        "relative grid size-11 shrink-0 place-items-center rounded-full border border-brand-line bg-brand-card text-brand-purple-900 transition-colors hover:bg-brand-surface motion-reduce:transition-none",
        FOCUS,
      )}
    >
      <MoreHorizontal className="size-5" aria-hidden="true" />
      {unread && (
        <span
          aria-hidden="true"
          className="absolute start-1 top-1 size-[9px] rounded-full bg-brand-purple-900 ring-2 ring-brand-card"
        />
      )}
    </button>
  );
}

/**
 * Generation progress as a 3px rail over the bar's bottom hairline — the
 * progress card it replaces pushed the meals down while they were arriving.
 * Widths are the .plan-rail-{0..7} classes (sevenths), never an inline style.
 */
export function PlanBarRail({ ready, total, label }: { ready: number; total: number; label: string }) {
  const sevenths = total > 0 ? Math.min(7, Math.max(0, Math.round((7 * ready) / total))) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={ready}
      aria-label={label}
      className="pointer-events-none absolute inset-x-0 -bottom-px h-[3px] overflow-hidden lg:rounded-b-2xl"
    >
      <div
        className={clsx(
          "h-full bg-brand-purple-900 transition-[inline-size] duration-500 ease-out motion-reduce:transition-none",
          `plan-rail-${sevenths}`,
        )}
      />
    </div>
  );
}
