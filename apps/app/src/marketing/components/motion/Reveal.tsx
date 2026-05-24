"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const tags = {
  div: motion.div,
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  ul: motion.ul,
  li: motion.li,
  header: motion.header,
  section: motion.section,
} as const;

type Tag = keyof typeof tags;

type RevealProps = {
  as?: Tag;
  delayMs?: number;
  durationMs?: number;
  offset?: number;
  className?: string;
  children: ReactNode;
};

export function Reveal({
  as = "div",
  delayMs = 0,
  durationMs = 400,
  offset = 10,
  className,
  children,
}: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    const Native = as;
    return <Native className={className}>{children}</Native>;
  }

  const M = tags[as];
  return (
    <M
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: durationMs / 1000,
        ease: EASE,
        delay: delayMs / 1000,
      }}
      className={className}
    >
      {children}
    </M>
  );
}
