"use client";

import type { Meal, Ingredient, LocaleCode } from "@fitlife/plan-engine";
import { getSlotNameInLocale } from "@/lib/plans/dayMapping";
import { HOUSEKEEPER_STRINGS } from "@/lib/plans/locales";

// Short, mostly-universal unit labels (metric + common). Kept locale-agnostic.
const UNIT_SHORT: Record<string, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  tbsp: "tbsp",
  tsp: "tsp",
  cup: "cup",
  piece: "×",
  serving: "serving",
  unlimited: "∞",
};

function amountText(ing: Ingredient): string {
  if (ing.unit === "unlimited") return "∞";
  const unit = UNIT_SHORT[ing.unit] ?? ing.unit;
  const hasRange =
    ing.amount_min != null && ing.amount_max != null && ing.amount_min !== ing.amount_max;
  return hasRange ? `${ing.amount_min}–${ing.amount_max} ${unit}` : `${ing.amount} ${unit}`;
}

export function HousekeeperMealCard({
  meal,
  locale,
}: {
  meal: Meal;
  locale: LocaleCode;
}) {
  const t = HOUSEKEEPER_STRINGS[locale];
  const recipeName = meal.recipe_name_translated ?? meal.recipe_name_ar;
  const ingredients = meal.ingredients_translated ?? meal.ingredients;
  const ingredientsAreArabicFallback = !meal.ingredients_translated;
  const steps =
    meal.prep_steps_translated && meal.prep_steps_translated.length > 0
      ? meal.prep_steps_translated
      : meal.prep_steps_ar;
  const cookMin = meal.cook_time_minutes ?? meal.prep_time_minutes;

  return (
    <div className="meal-card bg-white rounded-2xl border border-brand-ink/10 p-4 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="inline-flex items-center rounded-full bg-brand-lavender/30 px-3 py-1 text-xs font-bold text-brand-purple-900">
          {getSlotNameInLocale(meal.slot, locale)}
        </span>
        {cookMin != null && (
          <span className="text-brand-ink-muted text-xs">
            {t.cooking_time}: {cookMin} {t.minutes}
          </span>
        )}
      </div>

      <h3 className="font-bold text-brand-ink text-lg leading-snug">{recipeName}</h3>

      <div className="mt-3">
        <p className="text-brand-ink-muted text-xs font-bold mb-1">
          {t.ingredients}
          {ingredientsAreArabicFallback && (
            <span className="font-normal"> · {t.arabic_names_note}</span>
          )}
        </p>
        <ul className="space-y-1">
          {ingredients.map((ing, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-brand-ink">{ing.name_ar}</span>
              <span className="text-brand-ink-muted tabular-nums text-xs">{amountText(ing)}</span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="mt-3 space-y-1.5 list-decimal list-inside">
        {steps.map((step, i) => (
          <li key={i} className="text-brand-ink text-sm leading-relaxed">
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
