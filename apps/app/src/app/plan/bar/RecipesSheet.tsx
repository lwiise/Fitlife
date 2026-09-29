"use client";

import type { RefObject } from "react";
import type { Meal } from "@fitlife/plan-engine";
import { Sheet } from "@/components/ui/sheet";
import { MealCard } from "../MealCard";

export interface RecipesSheetDish {
  meal: Meal;
  /** Whose plate an individual dish is — a shared pot names its own sharers. */
  forName: string | null;
  /** The reader's portion on a pot she shares, highlighted as «حصتك». */
  currentMemberId?: string;
  /** Sharers out of this occurrence: the card scales the batch for the rest. */
  absentMemberIds?: string[];
}

/**
 * «الوصفات» when the household has no cook with her own view: every dish of
 * the open day for the whole house, one pot listed once, each card expanding
 * to its ingredients and steps. Read-only on purpose — marking and absences
 * live on the plan itself, where the card knows whose tab it is on.
 */
export function RecipesSheet({
  open,
  onClose,
  title,
  note,
  dishes,
  memberNames,
  emptyText,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  /** «وصفات الثلاثاء ٢٩ سبتمبر» */
  title: string;
  /** One muted line above the list; omitted for a solo plan. */
  note?: string;
  dishes: RecipesSheetDish[];
  memberNames: Record<string, string>;
  emptyText: string;
  /** The trigger that opened it — focus goes back there on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} returnFocusRef={returnFocusRef}>
      <div className="px-1 pb-2">
        {dishes.length === 0 ? (
          <p className="px-2 py-6 text-center text-base text-brand-ink-muted">{emptyText}</p>
        ) : (
          <>
            {note && <p className="px-2 pb-3 text-meta text-brand-ink-muted">{note}</p>}
            <ul className="space-y-3">
              {dishes.map((d, i) => (
                <li key={`${d.meal.slot}|${d.meal.recipe_name_ar}|${i}`}>
                  {d.forName && (
                    <p className="px-2 pb-1 text-meta font-bold text-brand-ink-muted">
                      طبق {d.forName}
                    </p>
                  )}
                  <MealCard
                    meal={d.meal}
                    memberNames={memberNames}
                    currentMemberId={d.currentMemberId}
                    absentMemberIds={d.absentMemberIds}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
