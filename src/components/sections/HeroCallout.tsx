"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const placements = {
  "top-end": {
    position: "top-[8%] end-[-8%] sm:end-[-12%]",
    lineSide: "after" as const,
  },
  "middle-start": {
    position: "top-[44%] start-[-10%] sm:start-[-14%]",
    lineSide: "before" as const,
  },
  "bottom-end": {
    position: "bottom-[10%] end-[-6%] sm:end-[-10%]",
    lineSide: "after" as const,
  },
};

type Placement = keyof typeof placements;

type HeroCalloutProps = {
  placement: Placement;
  delayMs: number;
  children: ReactNode;
};

export function HeroCallout({ placement, delayMs, children }: HeroCalloutProps) {
  const reduce = useReducedMotion();
  const { position, lineSide } = placements[placement];

  const line = (
    <span aria-hidden="true" className="h-px w-8 bg-brand-purple-300" />
  );
  const card = (
    <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-purple-700 shadow-md ring-1 ring-ink/5">
      {children}
    </span>
  );

  const inner =
    lineSide === "after" ? (
      <>
        {card}
        {line}
      </>
    ) : (
      <>
        {line}
        {card}
      </>
    );

  const className = `absolute ${position} z-10 flex items-center gap-2`;

  if (reduce) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: delayMs / 1000 }}
    >
      {inner}
    </motion.div>
  );
}
