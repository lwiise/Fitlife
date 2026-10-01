import { Dumbbell, Soup } from "lucide-react";
import type {
  HouseholdMember,
  MealSection,
  RunRow,
  WorkoutSection,
} from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import {
  HealthLink,
  HouseholdTable,
  MealPlanHistory,
  MealPlanTable,
  MealSummaryBox,
  MealWeekExplorer,
  ProgramHistory,
  ProgramSummaryBox,
  ProgramTable,
  ProgramWeekExplorer,
  RunsTable,
  TraineeList,
  mealPlanHref,
  programHref,
} from "../_blocks";
import { AuditLine, BtnLink, Card, Panel, PanelHead, SecTitle } from "../_ui";
import { OpeningLabel } from "./OpeningLabel";
import { TabLink } from "./TabLink";

/**
 * The family page's tab bodies (the prototype's `pageTabBody`), as plain
 * views over already-loaded sections: tabs.tsx loads, these render. Each view
 * returns the page's direct children — cards and `.ad-grid-2` rows — so the
 * page's own rhythm spaces them and a pending tab switch dims them. What is
 * built from the family's header instead (the summary's frame, billing) is
 * in ./headViews, rendered from the layout's one header read.
 *
 * Panel titles are h2 (the family's name is the page's h1). Links to the plan
 * and program views never prefetch: opening them is an audited access. So the
 * two primary «open» buttons read «جارٍ الفتح…» until the view arrives
 * (OpeningLabel); nothing was loaded ahead of the click.
 */

/** Earlier plans / programs beside the week; the full ledger is below it. */
const RECENT_LIMIT = 5;

// ── Summary ─────────────────────────────────────────────────────────────────

/**
 * The summary's meal plan panel (headViews' SummaryView slots it in): the
 * plan at a glance, with «فتح» into the meal tab.
 */
export function MealGlance({
  userId,
  meal,
  locale,
  currency,
}: {
  userId: string;
  meal: MealSection;
  locale: AdminLocale;
  currency: Currency;
}) {
  return (
    <Panel>
      <PanelHead
        action={
          <TabLink userId={userId} tab="meal" locale={locale}>
            {t("fp_open", locale)}
          </TabLink>
        }
      >
        <SecTitle as="h2" icon={Soup}>
          {t("fp_tab_meal", locale)}
        </SecTitle>
      </PanelHead>
      <MealSummaryBox section={meal} locale={locale} currency={currency} />
    </Panel>
  );
}

/** The summary's exercise panel: the program at a glance, with «فتح» into its tab. */
export function ProgramGlance({
  userId,
  workout,
  locale,
  currency,
}: {
  userId: string;
  workout: WorkoutSection;
  locale: AdminLocale;
  currency: Currency;
}) {
  return (
    <Panel>
      <PanelHead
        action={
          <TabLink userId={userId} tab="exercise" locale={locale}>
            {t("fp_open", locale)}
          </TabLink>
        }
      >
        <SecTitle as="h2" icon={Dumbbell}>
          {t("fp_tab_exercise", locale)}
        </SecTitle>
      </PanelHead>
      <ProgramSummaryBox section={workout} locale={locale} currency={currency} />
    </Panel>
  );
}

// ── Meal plan ───────────────────────────────────────────────────────────────

/**
 * The served week, one person and one day at a time, with the way into the
 * full read-only plan; beside it the current plan and the most recent earlier
 * ones; below, every plan with its run detail (the old page's plans table).
 */
export function MealView({
  userId,
  meal,
  household,
  locale,
  currency,
  todayIso,
}: {
  userId: string;
  meal: MealSection;
  household: readonly HouseholdMember[];
  locale: AdminLocale;
  currency: Currency;
  todayIso: string;
}) {
  const served = meal.served;
  const ledger =
    meal.plans.length > 0 ? (
      <Panel>
        <SecTitle as="h2">{t("fm_all_plans", locale)}</SecTitle>
        <MealPlanTable plans={meal.plans} userId={userId} locale={locale} currency={currency} />
      </Panel>
    ) : null;

  if (!served) {
    return (
      <>
        <Card>
          <MealSummaryBox section={meal} locale={locale} currency={currency} />
        </Card>
        {ledger}
      </>
    );
  }

  const earlier = meal.plans.filter((plan) => plan.id !== served.plan.id);
  return (
    <>
      <div className="ad-grid-2">
        <Panel>
          <MealWeekExplorer
            week={served.week}
            locale={locale}
            todayIso={todayIso}
            household={household}
          />
          <div className="ad-panel-h">
            <BtnLink
              href={mealPlanHref(userId, served.plan.id)}
              prefetch={false}
              variant="primary"
              icon={Soup}
            >
              <OpeningLabel
                label={t("fp_open_plan", locale)}
                pendingLabel={t("fm_opening", locale)}
              />
            </BtnLink>
            <AuditLine>{t("fp_audit_plan", locale)}</AuditLine>
          </div>
        </Panel>
        <div className="ad-col">
          <Panel>
            <SecTitle as="h2">{t("fp_current_plan", locale)}</SecTitle>
            <MealSummaryBox section={meal} locale={locale} currency={currency} />
          </Panel>
          {earlier.length > 0 ? (
            <Panel>
              <SecTitle as="h2">{t("fm_earlier_plans", locale)}</SecTitle>
              <MealPlanHistory
                plans={earlier}
                userId={userId}
                locale={locale}
                currency={currency}
                limit={RECENT_LIMIT}
              />
            </Panel>
          ) : null}
        </div>
      </div>
      {ledger}
    </>
  );
}

// ── Exercise plan ───────────────────────────────────────────────────────────

/**
 * The household's exercise program in whichever state it is (not opted in,
 * waiting for the meal run, generating, failed — with the previous program
 * still served when there is one — or ready): the program at a glance with
 * the way into the full read-only program, the week one trainee at a time
 * with this week's marks and intensity, who trains (and who never does), and
 * every program with its run detail. View only: no regenerate or retry.
 */
export function ExerciseView({
  userId,
  workout,
  locale,
  currency,
  todayWeekday,
}: {
  userId: string;
  workout: WorkoutSection;
  locale: AdminLocale;
  currency: Currency;
  todayWeekday: number | null;
}) {
  const served = workout.served;
  const ledger =
    workout.plans.length > 0 ? (
      <Panel>
        <SecTitle as="h2">{t("fp_all_programs", locale)}</SecTitle>
        <ProgramTable plans={workout.plans} userId={userId} locale={locale} currency={currency} />
      </Panel>
    ) : null;

  if (!served) {
    return (
      <>
        <Panel>
          <ProgramSummaryBox section={workout} locale={locale} currency={currency} />
        </Panel>
        {ledger}
      </>
    );
  }

  return (
    <>
      <Panel>
        <PanelHead
          action={
            <div className="ad-fp-open">
              <AuditLine>{t("fp_audit_program", locale)}</AuditLine>
              <BtnLink
                href={programHref(userId, served.plan.id)}
                prefetch={false}
                variant="primary"
                icon={Dumbbell}
              >
                <OpeningLabel
                  label={t("fp_open_program", locale)}
                  pendingLabel={t("fm_opening", locale)}
                />
              </BtnLink>
            </div>
          }
        >
          <SecTitle as="h2">{t("fm_program", locale)}</SecTitle>
        </PanelHead>
        <ProgramSummaryBox section={workout} locale={locale} currency={currency} />
        <ProgramWeekExplorer section={workout} locale={locale} todayWeekday={todayWeekday} />
      </Panel>
      <div className="ad-grid-2">
        <Panel>
          <SecTitle as="h2">{t("fm_trainees_label", locale)}</SecTitle>
          <TraineeList section={workout} locale={locale} todayWeekday={todayWeekday} />
        </Panel>
        <Panel>
          <SecTitle as="h2">{t("fm_prog_history", locale)}</SecTitle>
          <ProgramHistory
            plans={workout.plans}
            userId={userId}
            locale={locale}
            currency={currency}
            limit={RECENT_LIMIT}
          />
        </Panel>
      </div>
      {ledger}
    </>
  );
}

// ── Household, runs ─────────────────────────────────────────────────────────

/** The household with the protected way into its health detail. */
export function HouseholdView({
  userId,
  members,
  locale,
}: {
  userId: string;
  members: readonly HouseholdMember[];
  locale: AdminLocale;
}) {
  return (
    <Panel>
      <PanelHead action={<HealthLink userId={userId} locale={locale} />}>
        <SecTitle as="h2">{t("fp_tab_household", locale)}</SecTitle>
      </PanelHead>
      <HouseholdTable members={members} locale={locale} />
    </Panel>
  );
}

/** Every generation run, meal and exercise. */
export function RunsView({
  runs,
  locale,
  currency,
}: {
  runs: readonly RunRow[];
  locale: AdminLocale;
  currency: Currency;
}) {
  return (
    <Panel>
      <SecTitle as="h2">{t("section_generations", locale)}</SecTitle>
      <RunsTable runs={runs} locale={locale} currency={currency} />
    </Panel>
  );
}
