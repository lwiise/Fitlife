"use client";

import { motion, useReducedMotion } from "motion/react";
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
    const Native = as;
    return <Native className={className}>{children}</Native>;
  }

  const M = tags[as];
  const hidden = axis === "y" ? { opacity: 0, y: offset } : { opacity: 0, x: offset };
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
