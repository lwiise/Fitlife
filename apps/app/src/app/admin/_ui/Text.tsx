import type { ReactNode } from "react";
import { clsx } from "clsx";

/** A keyboard key (`.ad-kbd`). */
export function Kbd({ className, children }: { className?: string; children: ReactNode }) {
  return <kbd className={clsx("ad-kbd", className)}>{children}</kbd>;
}

/** An isolated left-to-right run (emails, ids) that translators skip. Put it
 * inside an RTL block — the block keeps its own direction and alignment. */
export function Ltr({ mono, className, children }: { mono?: boolean; className?: string; children: ReactNode }) {
  return (
    <span dir="ltr" translate="no" className={clsx(mono ? "ad-mono" : "ad-ltr", className)}>
      {children}
    </span>
  );
}

/** Arabic plan content (dish and session names) — always RTL and tagged
 * Arabic, even inside the English UI. */
export function ArText({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span lang="ar" dir="rtl" className={clsx("ad-ar-text", className)}>
      {children}
    </span>
  );
}
