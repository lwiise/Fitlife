import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";

const VARIANT: Record<BtnVariant, string> = {
  primary: "ad-btn-p",
  secondary: "ad-btn-s",
  ghost: "ad-btn-g",
  danger: "ad-btn-d",
  "danger-solid": "ad-btn-danger",
};

interface BtnLook {
  /** primary = the one filled action · secondary = outlined · ghost = text ·
   * danger = outlined red · danger-solid = the confirming destructive action. */
  variant?: BtnVariant;
  /** md = 40px (44px hit area) · lg = 44px. */
  size?: "md" | "lg";
  /** Leading icon. */
  icon?: LucideIcon;
  /** Trailing icon, mirrored in RTL — meant for chevrons/arrows. */
  iconEnd?: LucideIcon;
}

function btnClass({ variant = "secondary", size = "md" }: BtnLook, extra?: string) {
  return clsx("ad-btn", VARIANT[variant], size === "lg" && "ad-lg", extra);
}

function Inner({ icon: Icon, iconEnd: IconEnd, children }: BtnLook & { children?: ReactNode }) {
  return (
    <>
      {Icon ? <Icon className="ad-ic" aria-hidden="true" /> : null}
      {children}
      {IconEnd ? <IconEnd className="ad-ic ad-flip" aria-hidden="true" /> : null}
    </>
  );
}

/** A console button (`.ad-btn`). `type` defaults to "button". */
export function Btn({
  variant,
  size,
  icon,
  iconEnd,
  className,
  type = "button",
  children,
  ...rest
}: BtnLook & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={btnClass({ variant, size }, className)} {...rest}>
      <Inner icon={icon} iconEnd={iconEnd}>
        {children}
      </Inner>
    </button>
  );
}

/** A link drawn as a console button. */
export function BtnLink({
  variant,
  size,
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: BtnLook & ComponentProps<typeof Link>) {
  return (
    <Link className={btnClass({ variant, size }, className)} {...rest}>
      <Inner icon={icon} iconEnd={iconEnd}>
        {children}
      </Inner>
    </Link>
  );
}

/** An inline purple text link (`.ad-link`), e.g. «فتح ›». */
export function TextLink({
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: Pick<BtnLook, "icon" | "iconEnd"> & ComponentProps<typeof Link>) {
  return (
    <Link className={clsx("ad-link", className)} {...rest}>
      <Inner icon={icon} iconEnd={iconEnd}>
        {children}
      </Inner>
    </Link>
  );
}

/** A square 40px icon button (44px hit area). `label` is its accessible name
 * and tooltip. `flip` mirrors a directional icon in RTL. */
export function IconBtn({
  label,
  icon: Icon,
  flip,
  className,
  type = "button",
  ...rest
}: {
  label: string;
  icon: LucideIcon;
  flip?: boolean;
} & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx("ad-iconbtn", className)}
      {...rest}
    >
      <Icon className={flip ? "ad-ic ad-flip" : "ad-ic"} aria-hidden="true" />
    </button>
  );
}
