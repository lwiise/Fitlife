import Link from "next/link";
import { clsx } from "clsx";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { countAr, DAY_FORMS } from "@/lib/copy/plural";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";

/**
 * A plan being built, in the ticket's place: days whose meals exist for every
 * member of the plan, read from plan_data — not a timer.
 */
export function GenerationProgress({
  daysReady,
  ownerSex,
  firstPlan,
}: {
  daysReady: number;
  ownerSex: string | null;
  firstPlan: boolean;
}) {
  const g = genderPick(ownerSex);
  return (
    <section className="kt-ticket" aria-labelledby="gen-title" aria-live="polite">
      <div className="kt-head solo-end">
        <div className="kt-stamp">
          <p className="kt-slot">
            <b>{firstPlan ? "خطتكم الأولى" : "خطة الأسبوع الجديد"}</b>
            <span>قيد التجهيز</span>
          </p>
          <span className="kt-no">{arNum(daysReady)} من ٧</span>
        </div>
        <h2 className="kt-dish" id="gen-title">
          نجهّز أسبوعكم يوماً بيوم
        </h2>
        <div className="kt-gen" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} className={clsx(i < daysReady && "on")} />
          ))}
        </div>
        <p className="kt-who">
          {daysReady > 0 ? (
            <>
              جاهز <b>{countAr(daysReady, DAY_FORMS, arNum)}</b> من ٧
            </>
          ) : (
            "نحسب الأهداف ونختار أطباق الأسبوع"
          )}
        </p>
        <p className="kt-note">
          {g(
            "يستغرق ذلك من ٥ إلى ١٠ دقائق عادةً، ويمكنكِ إغلاق الصفحة، فالعمل يكتمل في الخلفية.",
            "يستغرق ذلك من ٥ إلى ١٠ دقائق عادةً، ويمكنك إغلاق الصفحة، فالعمل يكتمل في الخلفية.",
          )}
        </p>
        {daysReady > 0 && (
          <div className="kt-gen-acts">
            <Link className="kt-btn primary" href="/plan">
              عرض ما جهز حتى الآن
            </Link>
          </div>
        )}
      </div>
      <GeneratingPlanWatcher />
    </section>
  );
}
