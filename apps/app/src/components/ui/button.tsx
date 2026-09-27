import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

/**
 * The app's ONE button vocabulary (09/2026 redesign). Before this, the
 * signed-in app carried 37 hand-written button styles; every page now picks
 * from these four. Every size clears the 44px tap target, and the focus ring
 * is built in. Uses clsx, not cn(): tailwind-merge does not know the custom
 * text-* utilities and would silently drop one of two "conflicting" classes.
 *
 * - primary   — the ONE filled purple action on a screen
 * - secondary — outlined, for everything that is not the main action
 * - quiet     — text-weight action (links inside cards, "cancel")
 * - danger    — irreversible actions only (delete, cancel subscription)
 */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "lg";

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface",
    "disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
    size === "lg" ? "min-h-12 px-6 text-base" : "min-h-11 px-5 text-[15px]",
    block && "w-full",
    variant === "primary" &&
      "bg-brand-purple-900 text-white hover:bg-brand-purple-700",
    variant === "secondary" &&
      "border-[1.5px] border-brand-purple-900/25 bg-brand-card text-brand-purple-900 hover:bg-brand-tint",
    variant === "quiet" &&
      "px-3 text-brand-purple-900 hover:bg-brand-tint",
    variant === "danger" && "bg-critical text-white hover:bg-[#912018]",
    className,
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest} />
  );
}
