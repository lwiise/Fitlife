import Link from "next/link";
import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/**
 * The app's card surface. `plain` is the default content card (off-white on
 * the grey page); `tint` is for a highlighted block; `feature` is the one
 * purple hero a screen may have. Replaces ~46 hand-rolled card styles.
 */
export function Card({
  as: Tag = "section",
  tone = "plain",
  className,
  ...rest
}: {
  as?: "section" | "div" | "article" | "aside";
  tone?: "plain" | "tint" | "feature";
} & Omit<ComponentProps<"section">, "ref">) {
  return (
    <Tag
      className={clsx(
        "rounded-[1.375rem] p-4 sm:p-5",
        tone === "plain" && "border border-brand-line bg-brand-card",
        tone === "tint" && "bg-brand-tint",
        tone === "feature" && "bg-brand-purple-900 text-white",
        className,
      )}
      {...rest}
    />
  );
}

/** A card's heading row: section title on the start side, one link on the end. */
export function CardHeader({
  title,
  icon,
  action,
  id,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: { href: string; label: string };
  id?: string;
  className?: string;
}) {
  return (
    <div className={clsx("mb-2 flex items-center justify-between gap-3", className)}>
      <h2 id={id} className="flex items-center gap-2 text-app-section text-brand-ink">
        {icon}
        {title}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="-me-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[15px] font-bold text-brand-purple-900 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          {action.label}
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
