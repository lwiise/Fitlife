"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Users } from "lucide-react";
import type { Meal, Ingredient, LocaleCode } from "@fitlife/plan-engine";
import type { Verdict } from "@/lib/engagement/types";
import { getPlanStrings, type PlanStrings } from "@/lib/plans/locales";
import { getSlotNameInLocale } from "@/lib/plans/dayMapping";
import { formatNameList } from "@/lib/plans/formatNames";

const SLOT_STYLE: Record<Meal["slot"], { bg: string; text: string }> = {
  breakfast: { bg: "bg-brand-yellow/25", text: "text-brand-ink" },
  lunch: { bg: "bg-brand-purple-900/10", text: "text-brand-purple-900" },
  dinner: { bg: "bg-brand-pink-light", text: "text-brand-ink" },
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

// Inline check-in state for the plan page («تتبّع من هنا»). Chip labels are
// the exact vocabulary of the ختام اليوم sheet — one language everywhere.
export interface MealCheckinState {
  status: "cooked" | "swapped" | "skipped";
  reason: string | null;
}

const CHECKIN_STATUS_CHIPS = [
  { value: "cooked" as const, label: "طبختها كما هي" },
  { value: "swapped" as const, label: "بدّلتها" },
  { value: "skipped" as const, label: "تجاوزتها" },
];
const CHECKIN_REASON_CHIPS = [
  { value: "guests", label: "جاءنا ضيوف" },
  { value: "ordered_in", label: "طلبنا اليوم" },
  { value: "ate_out", label: "خارج البيت" },
  { value: "missing_ingredients", label: "لم تتوفر المقادير" },
  { value: "no_time", label: "ضاق الوقت" },
];
const CHECKIN_HEADER_LABEL: Record<MealCheckinState["status"], string> = {
  cooked: "طُبخت",
  swapped: "بُدّلت",
  skipped: "تُجوّزت",
};

// «كيف كانت؟» — the dish verdict, offered once a dish was actually cooked.
// Feeds golden dishes (loved) and vetoes (not_again) in the weekly digest.
// «نحبّها» wears the gold of a golden dish; nothing here reads as shame.
const VERDICT_CHIPS: { value: Verdict; label: string; selected: string }[] = [
  { value: "loved", label: "نحبّها", selected: "bg-brand-yellow text-brand-ink" },
  { value: "fine", label: "عادية", selected: "bg-brand-lavender text-brand-purple-900" },
  // First-person plural (family voice, matching «نحبّها») so it stays gender-
  // neutral for the cook rather than a feminine imperative.
  { value: "not_again", label: "لا نكرّرها", selected: "bg-brand-ink text-white" },
];

// One person's status chips (+ reason chips when swapped). Shared meals render
// one row of these PER PARTICIPANT — each person's status is separate; an
// individual meal renders a single row for the member whose tab is open.
function CheckinChips({
  state,
  onChange,
}: {
  state: MealCheckinState | null;
  onChange: (
    status: MealCheckinState["status"] | null,
    reason: string | null,
  ) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CHECKIN_STATUS_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() =>
              onChange(state?.status === c.value ? null : c.value, null)
            }
            aria-pressed={state?.status === c.value}
            className={`min-h-11 px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
              state?.status === c.value
                ? "bg-brand-purple-900 text-white"
                : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {state?.status === "swapped" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="السبب">
          {CHECKIN_REASON_CHIPS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() =>
                onChange(state.status, state.reason === r.value ? null : r.value)
              }
              aria-pressed={state.reason === r.value}
              className={`min-h-11 px-3 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                state.reason === r.value
                  ? "bg-brand-lavender text-brand-purple-900"
                  : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MealCard({
  meal,
  memberNames,
  locale,
  currentMemberId,
  checkin,
  sharedCheckins,
  onCheckin,
  verdict,
  onVerdict,
}: {
  meal: Meal;
  memberNames?: Record<string, string>;
  // When set to a non-Arabic locale, render translated fields + localized chrome.
  locale?: LocaleCode;
  // The member whose plan is currently open — used to highlight their portion in
  // a shared (family) recipe so "what you take" is obvious. Optional.
  currentMemberId?: string;
  /** The VIEWED member's inline mark (header badge + the single chip row on an
   * individual meal), when the surface tracks (plan page only). */
  checkin?: MealCheckinState | null;
  /** Shared meals only: each participant's own mark, keyed by member_id —
   * statuses are per person, never one answer for the whole dish. */
  sharedCheckins?: Record<string, MealCheckinState | null>;
  /** Present only on trackable days (any elapsed day of the plan week, never a
   * future day) — absent hides controls. memberId says whose status is set. */
  onCheckin?: (
    memberId: string,
    status: MealCheckinState["status"] | null,
    reason: string | null,
  ) => void;
  /** The viewed member's verdict on this dish (header/tracking); null = none. */
  verdict?: Verdict | null;
  /** Set the viewed member's verdict (null clears). Offered only once the dish
   * was cooked — you can only judge a dish you actually made. Absent = no
   * verdict control (untrackable day / read-only view). */
  onVerdict?: (verdict: Verdict | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
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
  // A shared meal gets a distinct, lavender-accented treatment so it reads as one
  // dish cooked for several people — not just another individual recipe.
  const isShared = !!meal.shared_recipe;
  // Who this meal is split between — named so the cook knows exactly who shares it.
  const participantNames = sharedPortions
    ? formatNameList(
        sharedPortions.map((p) => memberNames?.[p.member_id] ?? p.member_id),
        locale ?? "ar",
      )
    : "";

  return (
    <article
      className={`rounded-2xl overflow-hidden ${
        isShared
          ? "bg-brand-lavender/10 border border-brand-lavender/50 border-s-4 border-s-brand-purple-900/70"
          : "bg-brand-surface-elevated border border-brand-ink/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className="w-full text-start px-5 py-4 hover:bg-brand-ink/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface min-h-[3.5rem]"
      >
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${slotStyle.bg} ${slotStyle.text}`}
          >
            {slotLabel}
          </span>
          <div className="flex-1 min-w-0">
            {isShared && (
              <p className="flex items-start gap-1 mb-1 text-brand-purple-900 text-xs font-bold leading-relaxed">
                <Users className="size-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {t.shared_meal_with}
                  {participantNames ? `: ${participantNames}` : ""}
                </span>
              </p>
            )}
            <h3 className="font-bold text-brand-ink text-base leading-snug">
              {recipeName}
            </h3>
            <p className="mt-1 text-brand-ink-muted text-xs leading-relaxed tabular-nums">
              {meal.macros.protein_g} {t.protein} · {meal.macros.carbs_g} {t.carbs} ·{" "}
              {meal.macros.fat_g} {t.fat} ({t.grams})
            </p>
          </div>
          {checkin && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 ${
                checkin.reason === "guests"
                  ? "bg-brand-yellow text-brand-ink"
                  : checkin.status === "cooked"
                    ? "bg-brand-purple-900 text-white"
                    : "bg-brand-lavender/40 text-brand-purple-900"
              }`}
            >
              {checkin.status === "cooked" && (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              )}
              {CHECKIN_HEADER_LABEL[checkin.status]}
            </span>
          )}
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-extrabold text-brand-ink text-xl tabular-nums">
              {meal.calories}
            </span>
            <span className="text-brand-ink-muted text-xs">{t.calories_unit}</span>
          </div>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
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
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-brand-ink/5 space-y-4">
              {metaBits.length > 0 && (
                <p className="text-brand-ink-muted text-xs tabular-nums">
                  {metaBits.join(" · ")}
                </p>
              )}

              <section>
                <h4 className="font-bold text-brand-ink text-sm mb-2 flex items-center gap-2 flex-wrap">
                  <span>
                    {t.ingredients}
                    {sharedPortions ? ` (${t.base_recipe})` : ""}
                  </span>
                  {sharedPortions && meal.batch_finished_weight_g != null && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-purple-900/10 text-brand-purple-900 text-[11px] font-bold tabular-nums">
                      {t.batch_total} {meal.batch_finished_weight_g} {t.units.g}
                    </span>
                  )}
                </h4>
                <IngredientList items={ingredients} units={t.units} />
              </section>

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

              {sharedPortions && (
                <section>
                  <h4 className="font-bold text-brand-ink text-sm mb-2">
                    {t.per_member_portions}
                  </h4>
                  <ul className="space-y-2">
                    {sharedPortions.map((portion, i) => {
                      const isCurrent =
                        currentMemberId != null &&
                        portion.member_id === currentMemberId;
                      return (
                        <li
                          key={i}
                          className={`rounded-xl p-3 ${
                            isCurrent
                              ? "bg-brand-lavender/40 ring-1 ring-brand-purple-900/30"
                              : "bg-brand-surface/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-brand-ink text-xs min-w-0 truncate">
                              {memberNames?.[portion.member_id] ?? portion.member_id}
                              {isCurrent && (
                                <span className="ms-1.5 text-brand-purple-900 font-extrabold">
                                  {t.your_portion}
                                </span>
                              )}
                            </p>
                            {portion.portion_grams != null && (
                              <span className="flex-shrink-0 font-extrabold text-brand-purple-900 text-sm tabular-nums whitespace-nowrap">
                                {portion.portion_grams} {t.units.g}
                                {portion.portion_percentage != null
                                  ? ` · ${portion.portion_percentage}%`
                                  : ""}
                              </span>
                            )}
                          </div>
                          {portion.ingredients && portion.ingredients.length > 0 && (
                            <div className="mt-2">
                              <IngredientList items={portion.ingredients} units={t.units} />
                            </div>
                          )}
                          {!translated && portion.notes_ar && (
                            <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                              {portion.notes_ar}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

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

              {/* Per-meal tracking — the card's closing act, after the recipe.
                  A shared meal tracks EACH participant separately (Louis can
                  skip the dish anas ate); an individual meal tracks the member
                  whose tab is open. */}
              {onCheckin && (
                <div
                  className="pt-3 border-t border-brand-ink/5 space-y-2"
                  aria-label="تتبّع الوجبة"
                >
                  {sharedPortions && sharedCheckins ? (
                    <div className="space-y-3">
                      {sharedPortions.map((portion) => {
                        const name =
                          memberNames?.[portion.member_id] ?? portion.member_id;
                        const isCurrent =
                          currentMemberId != null &&
                          portion.member_id === currentMemberId;
                        return (
                          <div
                            key={portion.member_id}
                            role="group"
                            aria-label={`تتبّع ${name}`}
                            className="space-y-1.5"
                          >
                            <p
                              className={`text-xs font-bold ${
                                isCurrent
                                  ? "text-brand-purple-900"
                                  : "text-brand-ink"
                              }`}
                            >
                              {name}
                            </p>
                            <CheckinChips
                              state={sharedCheckins[portion.member_id] ?? null}
                              onChange={(status, reason) =>
                                onCheckin(portion.member_id, status, reason)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : currentMemberId != null ? (
                    <CheckinChips
                      state={checkin ?? null}
                      onChange={(status, reason) =>
                        onCheckin(currentMemberId, status, reason)
                      }
                    />
                  ) : null}
                  {/* Verdict — only for a dish that was actually cooked (you can
                      only judge what you made). One row for the viewed member. */}
                  {onVerdict && checkin?.status === "cooked" && (
                    <div
                      className="pt-1 space-y-1.5"
                      role="group"
                      aria-label="رأي العائلة في الطبق"
                    >
                      <p className="text-[11px] font-bold text-brand-ink-muted">
                        كيف كانت؟
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {VERDICT_CHIPS.map((v) => (
                          <button
                            key={v.value}
                            type="button"
                            onClick={() =>
                              onVerdict(verdict === v.value ? null : v.value)
                            }
                            aria-pressed={verdict === v.value}
                            className={`min-h-11 px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 ${
                              verdict === v.value
                                ? v.selected
                                : "border border-brand-ink/15 text-brand-ink-muted hover:bg-brand-lavender/20"
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-brand-ink-muted leading-relaxed">
                    تسجيلك يُحسّن خطة الأسبوع القادم — والضغط مرة أخرى يمسح الاختيار.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
