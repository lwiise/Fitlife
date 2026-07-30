"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

// Western digits by design (en-US formatting) — the page's numeric convention.
function format(n: number, decimalPlaces: number) {
  return Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(n);
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [motionValue, isInView, delay, value, direction, startValue, reduced]);

  useEffect(() => {
    if (reduced) return;
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = format(
          Number(latest.toFixed(decimalPlaces)),
          decimalPlaces,
        );
      }
    });
  }, [springValue, decimalPlaces, reduced]);

  // The resting number is what the server renders and what reduced-motion
  // users see: for direction="down" that is startValue (the animation's end),
  // so the true price is in the HTML before any JS runs.
  const resting = direction === "down" ? startValue : value;

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
      // Under OS reduced-motion the client's first render shows `resting`
      // while the server rendered `startValue` — identical for direction
      // "down" (this page's use), harmless text drift for "up".
      suppressHydrationWarning
      {...props}
    >
      {format(reduced ? resting : startValue, decimalPlaces)}
    </span>
  );
}
