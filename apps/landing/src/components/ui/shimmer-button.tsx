import * as React from "react";

import { cn } from "@/lib/utils";

// Magic UI shimmer button, brand-fixed and simplified: renders an <a> (every
// use on this page is a checkout link), purple-900 body with a rotating gold
// conic highlight tracked around a 1px rim. No inline styles — brand values
// are baked into the classes; the keyframes live in globals.css @theme. The
// shimmer layers stop under prefers-reduced-motion (globals.css), leaving a
// calm solid button. The effect has no start/end semantics, so it loops
// identically in RTL.
type ShimmerButtonProps = React.ComponentProps<"a"> & { href: string };

export function ShimmerButton({
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <a
      className={cn(
        "group relative z-0 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-brand-purple-900 px-8 py-3.5 text-base font-bold whitespace-nowrap text-white transition-transform select-none active:translate-y-px motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {/* spark container */}
      <span
        aria-hidden
        className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]"
      >
        <span className="animate-shimmer-slide absolute inset-0 h-[100cqh] [aspect-ratio:1]">
          <span className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_225deg,transparent_0,var(--color-gold-500)_90deg,transparent_90deg)] [translate:0_0]" />
        </span>
      </span>
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
      {/* inset highlight */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full shadow-[inset_0_-8px_10px_#ffffff1f] transition-shadow duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] motion-reduce:transition-none"
      />
      {/* backdrop cut — leaves a 1px shimmering rim */}
      <span
        aria-hidden
        className="absolute -z-20 rounded-full bg-brand-purple-900 [inset:1.5px]"
      />
    </a>
  );
}
