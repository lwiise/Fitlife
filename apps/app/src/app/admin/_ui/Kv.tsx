import type { ReactNode } from "react";
import { clsx } from "clsx";

/** A key-value grid (`<dl class="ad-kv">`), two columns (four with `cols={4}`);
 * one column on phones. */
export function Kv({
  cols = 2,
  className,
  children,
}: {
  cols?: 2 | 4;
  className?: string;
  children: ReactNode;
}) {
  return <dl className={clsx("ad-kv", cols === 4 && "ad-kv4", className)}>{children}</dl>;
}

/**
 * One key-value pair. `mono` renders the value as an isolated left-to-right
 * monospace run that translators skip — for emails, ids and codes inside an
 * RTL block (the block itself stays RTL so it aligns with its column).
 */
export function KvItem({
  label,
  mono,
  children,
}: {
  label: ReactNode;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {mono ? (
          <span className="ad-mono" dir="ltr" translate="no">
            {children}
          </span>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}
