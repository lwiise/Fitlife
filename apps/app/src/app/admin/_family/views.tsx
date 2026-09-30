import { Dumbbell, Soup } from "lucide-react";
import type {
  FamilyHeaderData,
  HouseholdMember,
  MealSection,
  RunRow,
  WorkoutSection,
} from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import {
  AccountFields,
  AttentionList,
  BillingFields,
  EngagementFields,
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
  SubscriptionHistory,
  SummaryFacts,
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
 * page's own rhythm spaces them and a pending tab switch dims them.
 *
 * Panel titles are h2 (the family's name is the page's h1). Links to the plan
 * and program views never prefetch: opening them is an audited access. So the
 * two primary «open» buttons read «جارٍ الفتح…» until the view arrives
 * (OpeningLabel); nothing was loaded ahead of the click.
 */

/** Earlier plans / programs beside the week; the full ledger is below it. */
const RECENT_LIMIT = 5;

type Header = FamilyHeaderData;

// ── Summary ─────────────────────────────────────────────────────────────────

export function SummaryView({
  userId,
  header,
  meal,
  workout,
  locale,
  currency,
  nowIso,
}: {
  userId: string;
  header: Header;
  meal: MealSection;
  workout: WorkoutSection;
  locale: AdminLocale;
  currency: Currency;
  nowIso: string;
}) {
  const open = t("fp_open", locale);
  return (
    <div className="ad-grid-2">
      <div className="ad-col">
        {header.reasons.length > 0 ? (
          <Panel>
            <SecTitle as="h2">{t("section_flags", locale)}</SecTitle>
            <AttentionList
              reasons={header.reasons}
              locale={locale}
              action={(reason) =>
                reason.tab === "summary" ? null : (
                  <TabLink userId={userId} tab={reason.tab} locale={locale} />
                )
              }
            />
          </Panel>
        ) : null}
        {/* The phone design leads with the key figures (people, renewal,
            lifetime AI cost, last active); from 1024px the page leaves them to
            the list and the panel, as the approved layout does. */}
        <Panel className="ad-phone-only">
          <SummaryFacts header={header} locale={locale} currency={currency} nowIso={nowIso} />
        </Panel>
        <Panel>
          <PanelHead
            action={
              <TabLink userId={userId} tab="meal" locale={locale}>
                {open}
              </TabLink>
            }
          >
            <SecTitle as="h2" icon={Soup}>
              {t("fp_tab_meal", locale)}
            </SecTitle>
          </PanelHead>
          <MealSummaryBox section={meal} locale={locale} currency={currency} />
        </Panel>
        <Panel>
          <PanelHead
            action={
              <TabLink userId={userId} tab="exercise" locale={locale}>
                {open}
              </TabLink>
            }
          >
            <SecTitle as="h2" icon={Dumbbell}>
              {t("fp_tab_exercise", locale)}
            </SecTitle>
          </PanelHead>
          <ProgramSummaryBox section={workout} locale={locale} currency={currency} />
        </Panel>
      </div>
      <div className="ad-col">
        <Panel>
          <SecTitle as="h2">{t("section_account", locale)}</SecTitle>
          <AccountFields header={header} locale={locale} />
        </Panel>
        <Panel>
          <SecTitle as="h2">{t("section_engagement", locale)}</SecTitle>
          <EngagementFields header={header} locale={locale} currency={currency} nowIso={nowIso} />
        </Panel>
      </div>
    </div>
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

// ── Household, billing, runs ────────────────────────────────────────────────

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

/** The subscription (and its history when there is more than one row) beside the account. */
export function BillingView({ header, locale }: { header: Header; locale: AdminLocale }) {
  return (
    <div className="ad-grid-2">
      <div className="ad-col">
        <Panel>
          <SecTitle as="h2">{t("section_subscription", locale)}</SecTitle>
          <BillingFields header={header} locale={locale} />
        </Panel>
        {header.subscriptionHistory.length > 1 ? (
          <Panel>
            <SecTitle as="h2">{t("section_sub_history", locale)}</SecTitle>
            <SubscriptionHistory rows={header.subscriptionHistory} locale={locale} />
          </Panel>
        ) : null}
      </div>
      <Panel>
        <SecTitle as="h2">{t("section_account", locale)}</SecTitle>
        <AccountFields header={header} locale={locale} />
      </Panel>
    </div>
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
