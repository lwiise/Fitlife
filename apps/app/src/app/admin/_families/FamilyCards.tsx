import { memo, type MouseEvent, type ReactNode } from "react";
import { Dumbbell, Soup, Users } from "lucide-react";
import type { FamilyRow } from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { Count, Flag, StatusPill, TierBadge } from "../_ui";
import { chipFlags, familyFlagLabel, familyFlagTone } from "../_blocks";
import { familyPageHref, mealCardParts, workoutCardText } from "./listModel";
import type { FamilyRowText } from "./types";

/**
 * Below 1024px the table becomes these cards (the prototype's phone list):
 * name and last activity; tier, status and flags; then meal days, exercise
 * state and people. Each card is a link to the family's full page — there is
 * no side panel on a phone. Like the table rows, the cards hold no handlers:
 * one delegated click on the list turns a plain tap into a client-side
 * navigation, and until the page arrives the tapped card reports aria-busy
 * and its start edge pulses while the others dim.
 */
export function FamilyCards({
  rows,
  texts,
  pendingId,
  locale,
  onClick,
  empty,
}: {
  rows: readonly FamilyRow[];
  texts: Readonly<Record<string, FamilyRowText>>;
  /** The card whose family page is on its way. */
  pendingId: string | null;
  locale: AdminLocale;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  empty: ReactNode;
}) {
  return (
    <div className="ad-pcards ad-phone-only" onClick={onClick}>
      {rows.length > 0
        ? rows.map((row) => (
            <Card
              key={row.userId}
              row={row}
              last={texts[row.userId]?.last ?? null}
              pending={row.userId === pendingId}
              locale={locale}
            />
          ))
        : empty}
    </div>
  );
}

const Card = memo(function Card({
  row,
  last,
  pending,
  locale,
}: {
  row: FamilyRow;
  last: string | null;
  pending: boolean;
  locale: AdminLocale;
}) {
  const name = row.displayName?.trim() || t("sh_unnamed", locale);
  // No «no flags» chip here — a quiet card is the default (the prototype's `chipFlags`).
  const flags = chipFlags(row.flags, false);
  const meal = mealCardParts(row.meal, locale);
  return (
    <a
      className="ad-pcard"
      href={familyPageHref(row.userId)}
      data-id={row.userId}
      aria-busy={pending || undefined}
    >
      {pending ? <span aria-hidden="true" className="ad-lp ad-on" /> : null}
      <span className="ad-r1">
        <b>
          <bdi>{name}</bdi>
        </b>
        <span>{last ?? "—"}</span>
      </span>
      <span className="ad-r2">
        {row.tier ? <TierBadge tier={row.tier} locale={locale} /> : null}
        <StatusPill status={row.status} locale={locale} />
        {flags.map((flag) => (
          <Flag key={flag} tone={familyFlagTone(flag)}>
            {familyFlagLabel(flag, locale)}
          </Flag>
        ))}
      </span>
      <span className="ad-r3">
        <span>
          <Soup className="ad-ic" aria-hidden="true" />
          <span className="ad-sr">{t("fl_meal_plan", locale)}: </span>
          {meal.state}
          {meal.days ? <Count>{meal.days}</Count> : null}
        </span>
        <span>
          <Dumbbell className="ad-ic" aria-hidden="true" />
          <span className="ad-sr">{t("fl_exercise_plan", locale)}: </span>
          {workoutCardText(row.workout, locale)}
        </span>
        <span>
          <Users className="ad-ic" aria-hidden="true" />
          <span className="ad-sr">{t("fm_people", locale)}: </span>
          {fmtNumber(row.beneficiaries, locale)}
        </span>
      </span>
    </a>
  );
});
