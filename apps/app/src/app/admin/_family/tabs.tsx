import type { FamilyTab } from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import {
  loadHousehold,
  loadMealSection,
  loadRuns,
  loadWorkoutSection,
} from "@/lib/admin/family";
import { todayWeekdayFrom } from "../_blocks";
import { weekdayOfIso } from "../_blocks/helpers";
import { AccountFromHead, BillingFromHead, SummaryFromHead } from "./headSnapshot";
import {
  ExerciseView,
  HouseholdView,
  MealGlance,
  MealView,
  ProgramGlance,
  RunsView,
} from "./views";

/**
 * The family page's tab bodies, rendered inside the page's
 * <Suspense key={tab}>. Each reads only the sections its tab shows
 * (model.ts, tabSections) — never the header: the family layout reads that
 * once per visit and hands it to the tabs built from it (./headSnapshot), so
 * billing and the account actions read nothing at all and the summary reads
 * only its two sections. The loaders are `cache()`d per request and share
 * one reader per family, so a section the page preloaded, or a table the
 * layout's header read already fetched on a first load, is never read twice.
 */

export interface TabContext {
  userId: string;
  locale: AdminLocale;
  currency: Currency;
  /** The request's "now" (ISO) — relative times are measured from it. */
  nowIso: string;
  /** Today in Riyadh (YYYY-MM-DD) — the week explorers open on it. */
  todayIso: string;
}

async function SummaryTab(ctx: TabContext) {
  const [meal, workout] = await Promise.all([
    loadMealSection(ctx.userId),
    loadWorkoutSection(ctx.userId),
  ]);
  return (
    <SummaryFromHead
      meal={<MealGlance userId={ctx.userId} meal={meal} locale={ctx.locale} currency={ctx.currency} />}
      program={
        <ProgramGlance
          userId={ctx.userId}
          workout={workout}
          locale={ctx.locale}
          currency={ctx.currency}
        />
      }
      locale={ctx.locale}
      currency={ctx.currency}
      nowIso={ctx.nowIso}
    />
  );
}

async function MealTab(ctx: TabContext) {
  const [meal, household] = await Promise.all([
    loadMealSection(ctx.userId),
    loadHousehold(ctx.userId),
  ]);
  return (
    <MealView
      userId={ctx.userId}
      meal={meal}
      household={household}
      locale={ctx.locale}
      currency={ctx.currency}
      todayIso={ctx.todayIso}
    />
  );
}

async function ExerciseTab(ctx: TabContext) {
  const workout = await loadWorkoutSection(ctx.userId);
  // The section's mark window ends today (Riyadh); without one, the request's day.
  const todayWeekday = todayWeekdayFrom(workout) ?? weekdayOfIso(ctx.todayIso);
  return (
    <ExerciseView
      userId={ctx.userId}
      workout={workout}
      locale={ctx.locale}
      currency={ctx.currency}
      todayWeekday={todayWeekday}
    />
  );
}

async function HouseholdTab(ctx: TabContext) {
  const members = await loadHousehold(ctx.userId);
  return <HouseholdView userId={ctx.userId} members={members} locale={ctx.locale} />;
}

async function RunsTab(ctx: TabContext) {
  const runs = await loadRuns(ctx.userId);
  return <RunsView runs={runs} locale={ctx.locale} currency={ctx.currency} />;
}

export function FamilyTabBody({ tab, ...ctx }: TabContext & { tab: FamilyTab }) {
  switch (tab) {
    case "meal":
      return <MealTab {...ctx} />;
    case "exercise":
      return <ExerciseTab {...ctx} />;
    case "household":
      return <HouseholdTab {...ctx} />;
    case "billing":
      return <BillingFromHead locale={ctx.locale} />;
    case "runs":
      return <RunsTab {...ctx} />;
    case "account":
      return <AccountFromHead locale={ctx.locale} />;
    default:
      return <SummaryTab {...ctx} />;
  }
}
