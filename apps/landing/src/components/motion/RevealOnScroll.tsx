"use client";

import { motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const tags = {
  div: motion.div,
  header: motion.header,
  li: motion.li,
  article: motion.article,
} as const;

type Tag = keyof typeof tags;

type RevealOnScrollProps = {
  as?: Tag;
  delayIndex?: number;
  staggerMs?: number;
  durationMs?: number;
  offset?: number;
  axis?: "x" | "y";
  className?: string;
  children: ReactNode;
};

export function RevealOnScroll({
  as = "div",
  delayIndex = 0,
  staggerMs = 100,
  durationMs = 500,
  offset = 20,
  axis = "y",
  className,
  children,
}: RevealOnScrollProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    // The server always renders the motion branch (reduce is null there), so
    // the DOM arrives with the hidden state inline (opacity:0). This branch
    // hydrates onto that same host tag, and React does NOT patch attribute
    // mismatches during hydration in production — a style prop alone leaves
    // reduced-motion users with permanently invisible sections. The ref
    // callback runs after mount and clears the stale style imperatively.
    const Native = as as React.ElementType;
    return (
      <Native
        className={className}
        ref={(el: HTMLElement | null) => {
          if (el) {
            el.style.opacity = "1";
            el.style.transform = "none";
          }
        }}
      >
        {children}
      </Native>
    );
  }

  const M = tags[as];
  const hidden =
    axis === "y" ? { opacity: 0, y: offset } : { opacity: 0, x: offset };
  const shown = axis === "y" ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 };

  return (
    <M
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: durationMs / 1000,
        ease: EASE,
        delay: (delayIndex * staggerMs) / 1000,
      }}
      className={className}
    >
      {children}
    </M>
  );
}
