"use client";

import { track } from "@/marketing/lib/analytics";

// Tiny client wrappers so server-rendered sections can fire an analytics event
// on interaction without shipping their whole markup as client JS.

export function TrackedLink({
  event,
  eventProps,
  href,
  className,
  children,
}: {
  event: string;
  eventProps?: Record<string, unknown>;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={() => track(event, eventProps)}
      className={className}
    >
      {children}
    </a>
  );
}

export function TrackedButton({
  event,
  eventProps,
  className,
  children,
}: {
  event: string;
  eventProps?: Record<string, unknown>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => track(event, eventProps)}
      className={className}
    >
      {children}
    </button>
  );
}
