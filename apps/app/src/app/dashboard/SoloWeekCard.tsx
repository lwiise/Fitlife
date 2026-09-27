import { Card } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { genderPick } from "@/lib/copy/gender";
import { arNum, arPct } from "@/lib/copy/numbers";
import type { RankedMember } from "@/lib/engagement/seasonMath";

/** A one-person household's week: the same completion figure the family
 * board ranks by, so a solo home screen is never empty. */
export function SoloWeekCard({
  me,
  ownerSex,
}: {
  me: RankedMember;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  const parts = [`${arNum(me.mealsMarked)} من ${arNum(me.mealsPlanned)} وجبات`];
  if (me.sessionsPlanned !== undefined) {
    parts.push(`${arNum(me.sessionsMarked ?? 0)} من ${arNum(me.sessionsPlanned)} حصص`);
  }
  return (
    <Card aria-labelledby="solo-week-title">
      <div className="flex items-center gap-4">
        <Ring frac={me.pct} label={`${arPct(me.pct)} من خطة الأسبوع`}>
          <b className="text-xl font-extrabold leading-none text-brand-purple-900">{arPct(me.pct)}</b>
          <small className="mt-0.5 text-[13px] text-brand-ink-muted">{g("من أسبوعكِ", "من أسبوعك")}</small>
        </Ring>
        <div className="min-w-0">
          <h2 id="solo-week-title" className="text-app-section text-brand-ink">
            {g("أسبوعكِ", "أسبوعك")}
          </h2>
          <p className="mt-1 text-base text-brand-ink">{parts.join(" · ")}</p>
          <p className="mt-1 text-meta text-brand-ink-muted">
            تُحتسب الوجبة المطبوخة كما هي من الخطة.
          </p>
        </div>
      </div>
    </Card>
  );
}
