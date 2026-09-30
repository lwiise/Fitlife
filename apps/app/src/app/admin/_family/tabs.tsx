import type { FamilyHeaderData, FamilyTab } from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import {
  loadHousehold,
  loadMealSection,
  loadRuns,
  loadWorkoutSection,
} from "@/lib/admin/family";
import { AccountDangerZone } from "../_components/AccountDangerZone";
import { todayWeekdayFrom } from "../_blocks";
import { weekdayOfIso } from "../_blocks/helpers";
import {
  BillingView,
  ExerciseView,
  HouseholdView,
  MealView,
  RunsView,
  SummaryView,
} from "./views";

/**
 * The family page's tab bodies as async server components, rendered inside
 * the page's <Suspense key={tab}>: each awaits only the sections its tab shows
 * (the header is already loaded and passed down), so the page head paints
 * first and the body streams in. The loaders are `cache()`d per request and
 * share one reader per family, so a section the page preloaded, or a table
 * the header already read, is never read twice.
 */

export interface TabContext {
  userId: string;
  header: FamilyHeaderData;
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
    <SummaryView
      userId={ctx.userId}
      header={ctx.header}
      meal={meal}
      workout={workout}
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
      return <BillingView header={ctx.header} locale={ctx.locale} />;
    case "runs":
      return <RunsTab {...ctx} />;
    case "account":
      return (
        <AccountDangerZone
          userId={ctx.userId}
          email={ctx.header.email}
          displayName={ctx.header.displayName}
          deactivated={ctx.header.deactivated}
          locale={ctx.locale}
        />
      );
    default:
      return <SummaryTab {...ctx} />;
  }
}
