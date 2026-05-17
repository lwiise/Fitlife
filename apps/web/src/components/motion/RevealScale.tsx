"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

type RevealScaleProps = {
  delayMs?: number;
  durationMs?: number;
  fromScale?: number;
  className?: string;
  children: ReactNode;
};

export function RevealScale({
  delayMs = 100,
  durationMs = 600,
  fromScale = 0.97,
  className,
  children,
}: RevealScaleProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: fromScale }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: durationMs / 1000,
        ease: EASE,
        delay: delayMs / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
