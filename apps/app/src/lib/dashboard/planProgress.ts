import type { MealPlan } from "@fitlife/plan-engine";

/** Days of the week whose meals exist for EVERY member of the plan — what a
 * generating card can honestly call «جاهزة». */
export function daysReady(plan: MealPlan | null | undefined): number {
  if (!plan || plan.members.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const complete = plan.members.every((m) =>
      m.days.some((d) => d.day_index === i && d.meals.length > 0),
    );
    if (complete) n += 1;
  }
  return n;
}
