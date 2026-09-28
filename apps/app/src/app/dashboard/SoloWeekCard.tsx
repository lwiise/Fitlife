import { genderPick } from "@/lib/copy/gender";
import { arNum, arPct } from "@/lib/copy/numbers";
import type { RankedMember } from "@/lib/engagement/seasonMath";

/** A one-person household's week: the same completion figure the family
 * board ranks by, with no ranking, so a solo home screen is never empty. */
export function SoloWeekCard({
  me,
  ownerSex,
}: {
  me: RankedMember;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  return (
    <section className="kt-soloweek" aria-labelledby="solo-week-title">
      <div>
        <h2 id="solo-week-title">{g("أسبوعكِ", "أسبوعك")}</h2>
        <p>
          {arNum(me.mealsMarked)} من {arNum(me.mealsPlanned)} وجبة
          {me.sessionsPlanned !== undefined && (
            <>
              <i className="sep" aria-hidden="true" />
              {arNum(me.sessionsMarked ?? 0)} من {arNum(me.sessionsPlanned)} حصص تمرين
            </>
          )}
        </p>
      </div>
      <strong>{arPct(me.pct)}</strong>
    </section>
  );
}
