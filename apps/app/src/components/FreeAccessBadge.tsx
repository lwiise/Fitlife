import { FREE_ACCESS_NOTICE_AR, isFreeAccessMode } from "@/lib/subscription/freeAccess";

/**
 * On-screen marker shown only while the TEMPORARY free-access testing mode is on.
 *
 * The mode gives the whole product away, and its only other trace is an
 * environment variable nobody looks at. A build where every paywall silently
 * disappeared should not look identical to a normal one — this is the thing that
 * makes "wait, is that still on?" answerable at a glance, including from a
 * screenshot.
 *
 * Renders nothing at all when the mode is off, so it costs a build-time constant
 * fold in normal builds. A server component: `isFreeAccessMode()` reads an
 * inlined NEXT_PUBLIC_ value, so no client JavaScript is needed to decide.
 *
 * Deliberately `pointer-events-none` and in the corner: this app's primary CTAs
 * sit in the bottom band on mobile, and the layout's own comment records a past
 * bug where a fixed element there stole taps. It must never do that again.
 */
export function FreeAccessBadge() {
  if (!isFreeAccessMode()) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-2 end-2 z-40 pointer-events-none select-none rounded-full border border-brand-yellow/50 bg-brand-ink/85 px-3 py-1 text-[11px] font-bold leading-none text-brand-yellow shadow-lg"
    >
      {FREE_ACCESS_NOTICE_AR}
    </div>
  );
}
