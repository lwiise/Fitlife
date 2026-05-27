"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { Meal, Ingredient, LocaleCode } from "@fitlife/plan-engine";
import { getPlanStrings, type PlanStrings } from "@/lib/plans/locales";
import { getSlotNameInLocale } from "@/lib/plans/dayMapping";

const SLOT_STYLE: Record<Meal["slot"], { bg: string; text: string }> = {
  breakfast: { bg: "bg-brand-yellow/25", text: "text-brand-ink" },
  lunch: { bg: "bg-brand-purple-900/10", text: "text-brand-purple-900" },
  dinner: { bg: "bg-brand-pink-light", text: "text-brand-pink" },
  snack: { bg: "bg-brand-lavender/40", text: "text-brand-purple-900" },
};

function formatAmount(ing: Ingredient, units: PlanStrings["units"]): string {
  if (ing.unit === "unlimited") return units.unlimited;
  const unit = units[ing.unit] ?? ing.unit;
  const hasRange =
    ing.amount_min != null &&
    ing.amount_max != null &&
    ing.amount_min !== ing.amount_max;
  if (hasRange) return `${ing.amount_min}-${ing.amount_max} ${unit}`;
  return `${ing.amount} ${unit}`;
}

function IngredientList({
  items,
  units,
}: {
  items: Ingredient[];
  units: PlanStrings["units"];
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((ing, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="text-brand-ink">{ing.name_ar}</span>
          <span className="text-brand-ink-muted tabular-nums text-xs">
            {formatAmount(ing, units)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MealCard({
  meal,
  memberNames,
  locale,
}: {
  meal: Meal;
  memberNames?: Record<string, string>;
  // When set to a non-Arabic locale, render translated fields + localized chrome.
  locale?: LocaleCode;
}) {
  const [expanded, setExpanded] = useState(false);
  const slotStyle = SLOT_STYLE[meal.slot];

  const translated = !!locale && locale !== "ar";
  const t = getPlanStrings(locale ?? "ar");

  const slotLabel = translated ? getSlotNameInLocale(meal.slot, locale) : meal.slot_name_ar;
  const recipeName = translated
    ? (meal.recipe_name_translated ?? meal.recipe_name_ar)
    : meal.recipe_name_ar;
  const ingredients = translated
    ? (meal.ingredients_translated ?? meal.ingredients)
    : meal.ingredients;
  const steps =
    translated && meal.prep_steps_translated?.length
      ? meal.prep_steps_translated
      : meal.prep_steps_ar;

  const metaBits: string[] = [];
  if (meal.prep_time_minutes != null)
    metaBits.push(`${t.prep_time} ${meal.prep_time_minutes} ${t.min_abbr}`);
  if (meal.cook_time_minutes != null)
    metaBits.push(`${t.cook_time} ${meal.cook_time_minutes} ${t.min_abbr}`);
  if (meal.servings_count != null)
    metaBits.push(`${meal.servings_count} ${t.servings_unit}`);

  const sharedPortions =
    meal.shared_recipe && meal.per_member_portions?.length
      ? meal.per_member_portions
      : null;

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
            {slotLabel}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-brand-ink text-base leading-snug">
              {recipeName}
              {meal.shared_recipe && (
                <span className="ms-2 inline-block align-middle text-[10px] font-bold text-brand-purple-900 bg-brand-lavender/40 rounded-full px-2 py-0.5">
                  {t.family_recipe}
                </span>
              )}
            </h3>
            <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed tabular-nums">
              {meal.macros.protein_g} {t.protein} · {meal.macros.carbs_g} {t.carbs} ·{" "}
              {meal.macros.fat_g} {t.fat} ({t.grams})
            </p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-extrabold text-brand-ink text-xl tabular-nums">
              {meal.calories}
            </span>
            <span className="text-brand-ink-muted text-xs">{t.calories_unit}</span>
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
              {metaBits.length > 0 && (
                <p className="text-brand-ink-muted text-xs tabular-nums">
                  {metaBits.join(" · ")}
                </p>
              )}

              <section>
                <h4 className="font-bold text-brand-ink text-sm mb-2">
                  {t.ingredients}{sharedPortions ? ` (${t.base_recipe})` : ""}
                </h4>
                <IngredientList items={ingredients} units={t.units} />
              </section>

              {sharedPortions && (
                <section>
                  <h4 className="font-bold text-brand-ink text-sm mb-2">
                    {t.per_member_portions}
                  </h4>
                  <div className="space-y-3">
                    {sharedPortions.map((portion, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-brand-surface/60 p-3"
                      >
                        <p className="font-bold text-brand-ink text-xs mb-1.5">
                          {memberNames?.[portion.member_id] ??
                            portion.member_id}
                        </p>
                        <IngredientList items={portion.ingredients} units={t.units} />
                        {!translated && portion.notes_ar && (
                          <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                            {portion.notes_ar}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="font-bold text-brand-ink text-sm mb-2">
                  {t.prep_steps}
                </h4>
                <ol className="space-y-2 list-decimal list-inside marker:text-brand-purple-900 marker:font-bold">
                  {steps.map((step, i) => (
                    <li
                      key={i}
                      className="text-brand-ink text-sm leading-relaxed"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </section>

              {/* Substitutions + notes have no translated source → Arabic-only view. */}
              {!translated && meal.substitutions_ar && meal.substitutions_ar.length > 0 && (
                <section>
                  <h4 className="font-bold text-brand-ink text-sm mb-2">
                    {t.substitutions}
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside marker:text-brand-purple-900">
                    {meal.substitutions_ar.map((sub, i) => (
                      <li
                        key={i}
                        className="text-brand-ink text-sm leading-relaxed"
                      >
                        {sub}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!translated && meal.notes_ar && (
                <p className="text-brand-ink-muted text-xs leading-relaxed bg-brand-surface/60 rounded-xl p-3">
                  {meal.notes_ar}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
