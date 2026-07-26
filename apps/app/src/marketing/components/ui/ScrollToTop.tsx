"use client";

import { ChevronUp } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { useState } from "react";

import { track } from "@/lib/analytics";

export function ScrollToTop() {
  const reduced = useReducedMotion() ?? false;
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 600);
  });

  const handleClick = () => {
    track("scroll_to_top_clicked");
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={reduced ? false : { opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.8, y: 20 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.2, ease: "easeOut" as const }
          }
          onClick={handleClick}
          aria-label="العودة إلى الأعلى"
          className="fixed bottom-8 end-8 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-primary shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FFC927] hover:shadow-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <ChevronUp className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
