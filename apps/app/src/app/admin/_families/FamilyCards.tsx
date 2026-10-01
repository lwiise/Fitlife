import { memo, type MouseEvent, type ReactNode } from "react";
import { Dumbbell, Soup, Users } from "lucide-react";
import type { FamilyRow, FamilySortKey } from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { Count, Flag, StatusPill, TierBadge } from "../_ui";
import { chipFlags, familyFlagLabel, familyFlagTone } from "../_blocks";
import { cardCorner, familyPageHref, mealCardParts, workoutCardText } from "./listModel";
import type { FamilyRowText } from "./types";

/**
 * Below 1024px the table becomes these cards (the prototype's phone list):
 * name and last activity — or, sorted by the signup date, the AI cost or the
 * plans, that value (cardCorner); tier, status and flags; then meal days,
 * exercise state and people. Each card is a link to the family's full page —
 * there is no side panel on a phone. Like the table rows, the cards hold no
 * handlers: one delegated click on the list turns a plain tap into a
 * client-side navigation, and until the page arrives the tapped card reports
 * aria-busy and its start edge pulses while the others dim.
 */
export function FamilyCards({
  rows,
  texts,
  sort,
  pendingId,
  locale,
  onClick,
  empty,
}: {
  rows: readonly FamilyRow[];
  texts: Readonly<Record<string, FamilyRowText>>;
  /** What the list is sorted by: the corner shows it when the card would not. */
  sort: FamilySortKey;
  /** The card whose family page is on its way. */
  pendingId: string | null;
  locale: AdminLocale;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  empty: ReactNode;
}) {
  return (
    <div className="ad-pcards ad-phone-only" onClick={onClick}>
      {rows.length > 0 ? (
        <>
          <CardIconSprite />
          {rows.map((row) => (
            <Card
              key={row.userId}
              row={row}
              corner={cardCorner(sort, row, texts[row.userId], locale)}
              pending={row.userId === pendingId}
              locale={locale}
            />
          ))}
        </>
      ) : (
        empty
      )}
    </div>
  );
}

// ── The cards' line icons, drawn once ───────────────────────────────────────
// Every card shows the same three icons. Inline, they were most of a card's
// markup — fifty times over, server-rendered beside the table the cards stand
// in for (the server cannot know which of the two a screen shows). So the
// list draws each once, as a <symbol>, and every card points at it (<use>).

const CARD_ICONS = { meal: Soup, workout: Dumbbell, people: Users } as const;
type CardIconName = keyof typeof CARD_ICONS;

/** Unique on the page: the families page renders one card list. */
const iconId = (name: CardIconName) => `ad-fl-icon-${name}`;

function CardIconSprite() {
  return (
    <svg className="ad-fl-sprite" aria-hidden="true" focusable="false">
      {(Object.keys(CARD_ICONS) as CardIconName[]).map((name) => {
        const Icon = CARD_ICONS[name];
        return (
          <symbol key={name} id={iconId(name)} viewBox="0 0 24 24">
            {/* .ad-ic's stroke, which a symbol's content does not take from the page. */}
            <Icon strokeWidth={1.9} />
          </symbol>
        );
      })}
    </svg>
  );
}

function CardIcon({ name }: { name: CardIconName }) {
  return (
    <svg className="ad-ic" aria-hidden="true" focusable="false">
      <use href={`#${iconId(name)}`} />
    </svg>
  );
}

const Card = memo(function Card({
  row,
  corner,
  pending,
  locale,
}: {
  row: FamilyRow;
  corner: string;
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
        <span>{corner}</span>
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
          <CardIcon name="meal" />
          <span className="ad-sr">{t("fl_meal_plan", locale)}: </span>
          {meal.state}
          {meal.days ? <Count>{meal.days}</Count> : null}
        </span>
        <span>
          <CardIcon name="workout" />
          <span className="ad-sr">{t("fl_exercise_plan", locale)}: </span>
          {workoutCardText(row.workout, locale)}
        </span>
        <span>
          <CardIcon name="people" />
          <span className="ad-sr">{t("fm_people", locale)}: </span>
          {fmtNumber(row.beneficiaries, locale)}
        </span>
      </span>
    </a>
  );
});
