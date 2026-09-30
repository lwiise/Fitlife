"use client";

import {
  memo,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronRight, Dumbbell, ExternalLink, RotateCw, Soup, X } from "lucide-react";
import {
  PANEL_TABS,
  type AttentionReason,
  type FamilyPanelData,
  type FamilyRow,
  type FamilyTab,
} from "@/lib/admin/console-types";
import type { AdminLocale, Currency } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import {
  Btn,
  BtnLink,
  Empty,
  IconBtn,
  Label,
  LinkPending,
  Ltr,
  Note,
  Pill,
  Skeleton,
  SkeletonGroup,
  StatusPill,
  TextLink,
  TierBadge,
  joinSep,
} from "../_ui";
import {
  AccountFields,
  AttentionList,
  BillingFields,
  EngagementFields,
  FamilyFlagChips,
  HealthLink,
  HouseholdTable,
  MealPlanHistory,
  MealPlanPill,
  MealSummaryBox,
  MealWeekExplorer,
  ProgramHistory,
  ProgramSummaryBox,
  SubscriptionHistory,
  SummaryFacts,
  TraineeList,
  WorkoutPlanPill,
  mealCellFromSection,
  mealPlanHref,
  programHref,
  todayWeekdayFrom,
  workoutCellFromSection,
} from "../_blocks";
import { fill, fmtDay, weekdayOfIso } from "../_blocks/helpers";
import { familyPageHref, isPanelTab, panelTabLabel } from "./listModel";
import type { PanelEntry } from "./panelLoader";
import type { FamilyRowText } from "./types";

/** Earlier meal plans / programs listed in the panel; the full page lists all. */
const MEAL_HISTORY_LIMIT = 3;
const PROGRAM_HISTORY_LIMIT = 5;

/** What the panel shows: the entry for `id`, and whether a request is running. */
export interface SheetView {
  id: string | null;
  entry: PanelEntry | null;
  busy: boolean;
}

export interface SheetActions {
  close: () => void;
  tab: (tab: FamilyTab) => void;
  retry: () => void;
  /** ↑/↓ on the heading: move to the next / previous row. */
  step: (step: "next" | "prev") => void;
}

/**
 * The side panel (the prototype's `aSheet` + `sheetBody`): one family at a
 * glance without leaving the list. Beside the table from 1280px, over it
 * (from the inline end) between 1024 and 1279px; never on a phone.
 *
 * The head paints at once from the list row; the body comes from ONE JSON
 * fetch (the console's PanelLoader) and shows a skeleton until then, a
 * "no longer exists" state on a 404 and a retry on a failure. A cached answer
 * being refreshed stays on screen, dimmed (`aria-busy`).
 *
 * Tabs are a real tablist: ←/→ move in reading order (so they flip in RTL),
 * Home/End jump, selection follows focus. The footer opens the served meal
 * plan or program (audited pages — links never prefetch) and the full family
 * page on the current tab; each link's underline pulses while its page is on
 * its way. Esc anywhere in the panel closes it; ↑/↓ on the heading move to
 * the next or previous family.
 *
 * A control inside the body that replaces the body — the summary's plan
 * cards and attention links switch the tab, retry swaps the error for a
 * skeleton — hands focus to the tab panel, so focus never falls back to the
 * page (where ↑/↓ would walk the list instead of scrolling the panel).
 *
 * "Now" and "today" for the blocks were fixed when the answer arrived
 * (PanelEntry) — never read from the clock while rendering.
 */
export const FamilySheet = memo(function FamilySheet({
  id,
  tab,
  view,
  row,
  rowText,
  locale,
  currency,
  headingRef,
  actions,
}: {
  id: string;
  tab: FamilyTab;
  view: SheetView;
  /** The list's row for this family (null when it is not in the list). */
  row: FamilyRow | null;
  rowText: FamilyRowText | null;
  locale: AdminLocale;
  currency: Currency;
  headingRef: RefObject<HTMLHeadingElement | null>;
  actions: SheetActions;
}) {
  const baseId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Set by a body control that replaces the body; the commit that replaces
  // it moves focus to the tab panel.
  const refocusRef = useRef(false);
  const entry = view.id === id ? view.entry : null;
  const busy = view.id !== id || view.busy;
  const data = entry?.result.kind === "ok" ? entry.result.data : null;
  const missing = entry?.result.kind === "missing";
  const header = data?.header ?? null;

  // Another family or another tab starts at the top.
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [id, tab]);

  useLayoutEffect(() => {
    if (!refocusRef.current) return;
    refocusRef.current = false;
    bodyRef.current?.focus({ preventScroll: true });
  });

  /** A tab switch from inside the body (the plan cards, an attention link). */
  function bodyTab(next: FamilyTab) {
    if (next === tab) return;
    refocusRef.current = true;
    actions.tab(next);
  }

  function retry() {
    refocusRef.current = true;
    actions.retry();
  }

  const name = header?.displayName?.trim() || row?.displayName?.trim() || null;
  const email = header ? header.email : (row?.email ?? null);
  const signup = rowText?.signup ?? (header ? fmtDay(header.signupAt, locale) : null);
  const tier = header ? (header.subscription?.tier ?? null) : (row?.tier ?? null);
  const status = header ? (header.subscription?.status ?? null) : (row?.status ?? null);
  const known = header !== null || row !== null;

  const headingId = `${baseId}-h`;
  const panelId = `${baseId}-panel`;
  const tabId = (value: FamilyTab) => `${baseId}-tab-${value}`;

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    actions.close();
  }

  function onHeadingKey(event: KeyboardEvent<HTMLHeadingElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    actions.step(event.key === "ArrowDown" ? "next" : "prev");
  }

  function onTabsKey(event: KeyboardEvent<HTMLDivElement>) {
    const count = PANEL_TABS.length;
    const index = PANEL_TABS.indexOf(tab);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number | null = null;
    if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (index + 1) % count;
    else if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    const target = next === null ? undefined : PANEL_TABS[next];
    if (next === null || !target) return;
    event.preventDefault();
    actions.tab(target);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  let body: ReactNode;
  if (missing) {
    body = (
      <div className="ad-fl-state">
        <Empty title={t("fl_missing", locale)}>{t("fl_missing_b", locale)}</Empty>
        <Btn variant="secondary" className="ad-fl-state-act" onClick={actions.close}>
          {t("fl_close_panel", locale)}
        </Btn>
      </div>
    );
  } else if (entry?.result.kind === "error") {
    body = (
      <div className="ad-fl-state">
        <Note tone="crit" role="alert">
          {t("fl_load_error", locale)}
        </Note>
        <Btn variant="secondary" icon={RotateCw} className="ad-self-start" onClick={retry}>
          {t("retry", locale)}
        </Btn>
      </div>
    );
  } else if (data && entry) {
    body = (
      <TabBody
        id={id}
        tab={tab}
        data={data}
        entry={entry}
        locale={locale}
        currency={currency}
        onTab={bodyTab}
      />
    );
  } else {
    body = <BodySkeleton locale={locale} />;
  }

  let primary: ReactNode = null;
  if (tab === "meal" && data?.meal.served) {
    primary = (
      <BtnLink
        href={mealPlanHref(id, data.meal.served.plan.id)}
        prefetch={false}
        variant="primary"
        size="lg"
        icon={Soup}
      >
        {t("fl_open_plan", locale)}
        <LinkPending />
      </BtnLink>
    );
  } else if (tab === "exercise" && data?.workout.served) {
    primary = (
      <BtnLink
        href={programHref(id, data.workout.served.plan.id)}
        prefetch={false}
        variant="primary"
        size="lg"
        icon={Dumbbell}
      >
        {t("fl_open_program", locale)}
        <LinkPending />
      </BtnLink>
    );
  }

  return (
    <aside
      className="ad-a-sheet"
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      onKeyDown={onKeyDown}
    >
      <div className="ad-sh-head">
        <div className="ad-fl-sh-id">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} onKeyDown={onHeadingKey}>
            {name ? (
              <bdi>{name}</bdi>
            ) : known || !busy ? (
              t("sh_unnamed", locale)
            ) : (
              <>
                <Skeleton shape="title" className="ad-fl-skel-name" />
                <span className="ad-sr">{t("fl_loading_family", locale)}</span>
              </>
            )}
          </h2>
          {known ? (
            <p className="ad-meta">
              {joinSep(
                email ? <Ltr>{email}</Ltr> : "—",
                signup ? `${t("fm_customer_since", locale)} ${signup}` : null,
              )}
            </p>
          ) : (
            <Skeleton shape="text" className="ad-fl-skel-meta" />
          )}
        </div>
        <IconBtn label={t("fl_close_panel", locale)} icon={X} onClick={actions.close} />
      </div>

      <div className="ad-sh-chips">
        {known ? (
          <>
            {tier ? <TierBadge tier={tier} locale={locale} /> : null}
            <StatusPill status={status} locale={locale} />
          </>
        ) : null}
        {header ? (
          <FamilyFlagChips
            flags={header.flags}
            medicalGateBlocked={header.medicalGateBlocked}
            locale={locale}
          />
        ) : busy ? (
          <Skeleton shape="pill" />
        ) : null}
      </div>

      <div role="tablist" aria-label={t("fl_tabs", locale)} className="ad-tabs" onKeyDown={onTabsKey}>
        {PANEL_TABS.map((value) => (
          <button
            key={value}
            id={tabId(value)}
            type="button"
            role="tab"
            aria-selected={value === tab}
            aria-controls={panelId}
            tabIndex={value === tab ? 0 : -1}
            onClick={() => actions.tab(value)}
          >
            {panelTabLabel(value, locale)}
          </button>
        ))}
      </div>

      <div
        ref={bodyRef}
        id={panelId}
        className="ad-sh-body"
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        tabIndex={0}
      >
        {body}
      </div>

      {missing ? null : (
        <div className="ad-sh-foot">
          {primary}
          <BtnLink
            href={familyPageHref(id, tab)}
            prefetch={false}
            variant="secondary"
            size="lg"
            icon={ExternalLink}
          >
            {t("fl_full_page", locale)}
            <LinkPending />
          </BtnLink>
        </div>
      )}
    </aside>
  );
});

// ── Tab bodies (the prototype's sheetBody) ──────────────────────────────────

function TabBody({
  id,
  tab,
  data,
  entry,
  locale,
  currency,
  onTab,
}: {
  id: string;
  tab: FamilyTab;
  data: FamilyPanelData;
  entry: PanelEntry;
  locale: AdminLocale;
  currency: Currency;
  onTab: (tab: FamilyTab) => void;
}) {
  switch (tab) {
    case "meal":
      return <MealTab id={id} data={data} entry={entry} locale={locale} currency={currency} />;
    case "exercise":
      return <ExerciseTab id={id} data={data} entry={entry} locale={locale} currency={currency} />;
    case "household":
      return (
        <>
          <HouseholdTable members={data.household} locale={locale} />
          <div>
            <HealthLink userId={id} locale={locale} appearance="link" />
          </div>
        </>
      );
    case "billing":
      return (
        <>
          <BillingFields header={data.header} locale={locale} />
          {data.header.subscriptionHistory.length > 1 ? (
            <>
              <Label>{t("section_sub_history", locale)}</Label>
              <SubscriptionHistory rows={data.header.subscriptionHistory} locale={locale} />
            </>
          ) : null}
          <Label>{t("section_account", locale)}</Label>
          <AccountFields header={data.header} locale={locale} />
        </>
      );
    default:
      return (
        <SummaryTab data={data} entry={entry} locale={locale} currency={currency} onTab={onTab} />
      );
  }
}

function SummaryTab({
  data,
  entry,
  locale,
  currency,
  onTab,
}: {
  data: FamilyPanelData;
  entry: PanelEntry;
  locale: AdminLocale;
  currency: Currency;
  onTab: (tab: FamilyTab) => void;
}) {
  const { header, meal, workout } = data;
  return (
    <>
      <AttentionList
        reasons={header.reasons}
        locale={locale}
        action={(reason) => <ReasonAction reason={reason} locale={locale} onTab={onTab} />}
      />
      <SummaryFacts header={header} locale={locale} currency={currency} nowIso={entry.nowIso} />
      <div className="ad-summary-plans">
        <button type="button" className="ad-sp" onClick={() => onTab("meal")}>
          <span className="ad-spt">
            <Soup className="ad-ic" aria-hidden="true" />
            {t("fl_meal_plan", locale)}
          </span>
          <span className="ad-fl-sp-line">
            {meal.served ? (
              <MealPlanPill cell={mealCellFromSection(meal)} locale={locale} />
            ) : (
              t("fm_meal_none", locale)
            )}
          </span>
        </button>
        <button type="button" className="ad-sp" onClick={() => onTab("exercise")}>
          <span className="ad-spt">
            <Dumbbell className="ad-ic" aria-hidden="true" />
            {t("fl_exercise_plan", locale)}
          </span>
          <span className="ad-fl-sp-line">
            {workout.waitingForMeals ? (
              <Pill tone="pur">{t("fl_waiting_meals", locale)}</Pill>
            ) : (
              <WorkoutPlanPill cell={workoutCellFromSection(workout)} locale={locale} />
            )}
          </span>
        </button>
      </div>
      <EngagementFields header={header} locale={locale} currency={currency} nowIso={entry.nowIso} />
    </>
  );
}

/** The link beside an attention reason to the tab that resolves it. */
function ReasonAction({
  reason,
  locale,
  onTab,
}: {
  reason: AttentionReason;
  locale: AdminLocale;
  onTab: (tab: FamilyTab) => void;
}) {
  if (reason.tab === "summary" || !isPanelTab(reason.tab)) return null;
  const target = reason.tab;
  const label = panelTabLabel(target, locale);
  return (
    <button
      type="button"
      className="ad-link"
      aria-label={fill(t("fl_go_tab", locale), { tab: label })}
      onClick={() => onTab(target)}
    >
      {label}
      <ChevronRight className="ad-ic ad-flip" aria-hidden="true" />
    </button>
  );
}

function MealTab({
  id,
  data,
  entry,
  locale,
  currency,
}: {
  id: string;
  data: FamilyPanelData;
  entry: PanelEntry;
  locale: AdminLocale;
  currency: Currency;
}) {
  const { meal, household } = data;
  const servedId = meal.served?.plan.id ?? null;
  const earlier = meal.plans.filter((plan) => plan.id !== servedId);
  return (
    <>
      <MealSummaryBox section={meal} locale={locale} currency={currency} />
      {meal.served ? (
        <MealWeekExplorer
          key={id}
          week={meal.served.week}
          locale={locale}
          todayIso={entry.todayIso}
          household={household}
        />
      ) : null}
      {earlier.length > 0 ? (
        <>
          <Label>{t("fm_earlier_plans", locale)}</Label>
          <MealPlanHistory
            plans={earlier}
            userId={id}
            locale={locale}
            currency={currency}
            limit={MEAL_HISTORY_LIMIT}
          />
          {earlier.length > MEAL_HISTORY_LIMIT ? (
            <MoreLink href={familyPageHref(id, "meal")}>{t("fm_all_plans", locale)}</MoreLink>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ExerciseTab({
  id,
  data,
  entry,
  locale,
  currency,
}: {
  id: string;
  data: FamilyPanelData;
  entry: PanelEntry;
  locale: AdminLocale;
  currency: Currency;
}) {
  const { workout } = data;
  // The section's mark window ends today (Riyadh); without one, the day the
  // answer arrived.
  const todayWeekday = todayWeekdayFrom(workout) ?? weekdayOfIso(entry.todayIso);
  return (
    <>
      <ProgramSummaryBox section={workout} locale={locale} currency={currency} />
      {workout.served ? (
        <>
          <Label>{t("fm_trainees_label", locale)}</Label>
          <TraineeList section={workout} locale={locale} todayWeekday={todayWeekday} />
        </>
      ) : null}
      {workout.plans.length > 0 ? (
        <>
          <Label>{t("fm_prog_history", locale)}</Label>
          <ProgramHistory
            plans={workout.plans}
            userId={id}
            locale={locale}
            currency={currency}
            limit={PROGRAM_HISTORY_LIMIT}
          />
          {workout.plans.length > PROGRAM_HISTORY_LIMIT ? (
            <MoreLink href={familyPageHref(id, "exercise")}>{t("fl_all_programs", locale)}</MoreLink>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** «كل الخطط ›» — the whole history, on the full page (audited: no prefetch). */
function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div>
      <TextLink href={href} prefetch={false} iconEnd={ChevronRight}>
        {children}
        <LinkPending />
      </TextLink>
    </div>
  );
}

/** The body's shape while the family loads: a summary box, a few lines, a table. */
function BodySkeleton({ locale }: { locale: AdminLocale }) {
  return (
    <SkeletonGroup label={t("fl_loading_family", locale)} className="ad-fl-sheet-skel">
      <Skeleton shape="block" className="ad-fl-skel-box" />
      <Skeleton shape="text" width={70} />
      <Skeleton shape="text" width={90} />
      <Skeleton shape="text" width={55} />
      <Skeleton shape="tile" />
    </SkeletonGroup>
  );
}
