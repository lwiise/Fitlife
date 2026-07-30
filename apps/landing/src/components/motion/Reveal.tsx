import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Scroll reveal, CSS-first. `Reveal` is a SERVER component — it only stamps
// `data-reveal` and a delay class; every moving part lives in globals.css and
// in the one bootstrap script below. That keeps the sections server-rendered
// (no client boundary, no per-element observer) and means a reveal costs
// nothing on the LCP path.
//
// The contract is deliberately inverted from the usual "hide, then animate in":
// markup ships VISIBLE, and the hidden state arrives only via the stylesheet
// the bootstrap injects once it has confirmed it can actually finish the job.
// See globals.css and ARMING_CSS below.

// Stagger delays as STATIC class strings — Tailwind cannot see a computed
// class, and this project bans inline styles. An index past the end reuses the
// last step so a long list never drifts into a sluggish tail. The values are
// the motion system's --reveal-stagger (90ms) multiplied out.
const DELAY_CLASS = [
  "[--reveal-delay:0ms]",
  "[--reveal-delay:90ms]",
  "[--reveal-delay:180ms]",
  "[--reveal-delay:270ms]",
  "[--reveal-delay:360ms]",
  "[--reveal-delay:450ms]",
] as const;

/**
 * The same stagger table, for accents that ride a parent `Reveal` instead of
 * getting their own (`rule-grow`, `pop-in`). Exported from here so every
 * literal Tailwind sees lives in one file.
 */
export const REVEAL_DELAY = DELAY_CLASS;

type RevealProps = {
  as?: ElementType;
  /** up = rise + fade (default) · rise = adds a hair of scale · fade = opacity only */
  variant?: "up" | "rise" | "fade";
  delayIndex?: number;
  className?: string;
  children: ReactNode;
};

export function Reveal({
  as: Tag = "div",
  variant = "up",
  delayIndex = 0,
  className,
  children,
}: RevealProps) {
  return (
    <Tag
      data-reveal={variant}
      className={cn(
        DELAY_CLASS[Math.min(delayIndex, DELAY_CLASS.length - 1)],
        className,
      )}
      // The bootstrap below runs before hydration, so anything already on
      // screen carries a `data-revealed` attribute the server never rendered.
      // That is the design — React must not treat it as a mismatch, and must
      // not strip it back off. Scoped to this element's own attributes; the
      // children hydrate normally.
      suppressHydrationWarning
    >
      {children}
    </Tag>
  );
}

// The arming rules — the ONLY place a section is ever hidden. Injected as a
// runtime <style> rather than shipped in globals.css so that the page is
// readable the instant it parses and stays readable if any of this fails.
//
// It is also why nothing here touches a class on <html> or <body>: those are
// React-rendered, and mutating them before hydration is a mismatch React will
// report and refuse to patch. A stylesheet lives outside React's tree entirely.
//
// Mirrors the variants in globals.css — add one there, add it here.
const ARMING_CSS = [
  `[data-reveal]:not([data-revealed]){opacity:0;will-change:transform,opacity}`,
  `[data-reveal="up"]:not([data-revealed]){transform:translate3d(0,var(--reveal-rise),0)}`,
  `[data-reveal="rise"]:not([data-revealed]){transform:translate3d(0,var(--reveal-rise),0) scale(.98)}`,
  `[data-reveal]:not([data-revealed]) .rule-grow{transform:scaleX(0)}`,
  `[data-reveal]:not([data-revealed]) .pop-in{transform:scale(.72)}`,
].join("");

// One shared IntersectionObserver for the whole page, installed before the
// sections are parsed so nothing flashes visible-then-hidden. Vanilla on
// purpose: it must not wait for React to hydrate, and it must survive a
// hydration error — the reveals are decorative, the copy is the product.
//
// Every way out ends with the content on screen:
//   · no IntersectionObserver, or reduced motion → sheet never injected
//   · anything throws                            → sheet removed
//   · observer never delivers a callback         → sheet removed 1.5s after load
const BOOTSTRAP = `(function(){var d=document,st=null;try{if(!("IntersectionObserver" in window))return;if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;st=d.createElement("style");st.textContent=${JSON.stringify(ARMING_CSS)};d.head.appendChild(st);var f=false;var o=new IntersectionObserver(function(en){f=true;for(var i=0;i<en.length;i++){if(en[i].isIntersecting){en[i].target.setAttribute("data-revealed","");o.unobserve(en[i].target)}}},{rootMargin:"0px 0px -10% 0px"});var s=function(){var n=d.querySelectorAll("[data-reveal]:not([data-revealed])");for(var i=0;i<n.length;i++)o.observe(n[i])};if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",s);else s();window.addEventListener("load",function(){s();setTimeout(function(){if(!f&&st)st.remove()},1500)})}catch(x){if(st)st.remove()}})();`;

/** Render once, as the first child of the page's <body>. */
export function RevealBootstrap() {
  return <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP }} />;
}
