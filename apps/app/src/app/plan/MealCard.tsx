"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { Meal } from "@fitlife/plan-engine";

const SLOT_STYLE: Record<Meal["slot"], { bg: string; text: string }> = {
  breakfast: { bg: "bg-brand-yellow/25", text: "text-brand-ink" },
  lunch: { bg: "bg-brand-purple-900/10", text: "text-brand-purple-900" },
  dinner: { bg: "bg-brand-pink-light", text: "text-brand-pink" },
  snack: { bg: "bg-brand-lavender/40", text: "text-brand-purple-900" },
};

const UNIT_AR: Record<string, string> = {
  g: "جم",
  ml: "مل",
  cup: "كوب",
  tbsp: "ملعقة كبيرة",
  piece: "حبة",
};

export function MealCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);
  const slotStyle = SLOT_STYLE[meal.slot];

  return (
    <article className="bg-white rounded-2xl border border-brand-ink/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className="w-full text-start px-5 py-4 hover:bg-brand-ink/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-[3.5rem]"
      >
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${slotStyle.bg} ${slotStyle.text}`}
          >
            {meal.slot_name_ar}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-brand-ink text-base leading-snug">
              {meal.recipe_name_ar}
            </h3>
            <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed tabular-nums">
              {meal.macros.protein_g} بروتين · {meal.macros.carbs_g} كارب ·{" "}
              {meal.macros.fat_g} دهون (جم)
            </p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-extrabold text-brand-ink text-xl tabular-nums">
              {meal.calories}
            </span>
            <span className="text-brand-ink-muted text-xs">سعرة</span>
          </div>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 mt-1"
            aria-hidden="true"
          >
            <ChevronDown className="size-5 text-brand-ink-muted" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-brand-ink/5 space-y-4">
              <section>
                <h4 className="font-bold text-brand-ink text-sm mb-2">
                  المكونات
                </h4>
                <ul className="space-y-1.5">
                  {meal.ingredients.map((ing, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-brand-ink">{ing.name_ar}</span>
                      <span className="text-brand-ink-muted tabular-nums text-xs">
                        {ing.amount} {UNIT_AR[ing.unit] ?? ing.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="font-bold text-brand-ink text-sm mb-2">
                  طريقة التحضير
                </h4>
                <ol className="space-y-2 list-decimal list-inside marker:text-brand-purple-900 marker:font-bold">
                  {meal.prep_steps_ar.map((step, i) => (
                    <li
                      key={i}
                      className="text-brand-ink text-sm leading-relaxed"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
