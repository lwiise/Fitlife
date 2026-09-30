/**
 * Shared family blocks (Concept A · Console): presentational pieces that
 * render the console-types shapes on BOTH the side panel (client) and the
 * full family page (server). Data comes in as props — plus `locale`, and
 * `currency` wherever money is shown — so nothing here fetches, and nothing
 * reads the clock during render: callers pass "today" (`todayIso`,
 * `todayWeekday`) and, for relative times, "now" (`nowIso` — REQUIRED on
 * SummaryFacts and EngagementFields).
 *
 * Client components (state/interaction): MealWeekExplorer,
 * ProgramWeekExplorer, HealthLink. Everything else has no hooks.
 */
export { AttentionList } from "./AttentionList";
export { FamilyFlagChips } from "./FamilyFlagChips";
export { MealPlanPill, WorkoutPlanPill } from "./PlanPills";
export { MealSummaryBox } from "./MealSummaryBox";
export { MealWeekExplorer } from "./MealWeekExplorer";
export { MealPlanHistory, MealPlanTable } from "./MealPlanHistory";
export { ProgramSummaryBox } from "./ProgramSummaryBox";
export { TraineeList, NotIncludedNote } from "./TraineeList";
export { ProgramWeekExplorer } from "./ProgramWeekExplorer";
export { ProgramHistory, ProgramTable } from "./ProgramHistory";
export { HouseholdTable } from "./HouseholdTable";
export { BillingFields, SubscriptionHistory } from "./BillingFields";
export { AccountFields, EngagementFields } from "./AccountFields";
export { HouseholdCell, RenewalCell, SummaryFacts } from "./SummaryFacts";
export { RunsTable, RunKindChip } from "./RunsTable";
export { HealthLink } from "./HealthLink";
export { DateText, ErrorText, PlanStatePill, SubscriptionStatusPill, TierTag } from "./parts";
export {
  chipFlags,
  familyFlagLabel,
  familyFlagTone,
  healthHref,
  mealCellFromSection,
  mealPlanHref,
  programHref,
  reasonSentence,
  showsCancelScheduled,
  todayWeekdayFrom,
  workoutCellFromSection,
} from "./helpers";
