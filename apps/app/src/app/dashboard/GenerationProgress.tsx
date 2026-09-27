import { clsx } from "clsx";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { GeneratingPlanWatcher } from "./GeneratingPlanWatcher";

/**
 * A plan being built, shown as what is actually written: days whose meals
 * exist for every member of the plan, read from plan_data — not a timer.
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
    <Card aria-labelledby="gen-title" aria-live="polite">
      <CardHeader id="gen-title" title={firstPlan ? "خطتكم قيد الإعداد" : "خطة جديدة قيد الإعداد"} />
      <p className="text-base leading-relaxed text-brand-ink-muted">
        {g(
          "يستغرق ذلك عادةً من خمس إلى عشر دقائق، ويمكنكِ إغلاق الصفحة.",
          "يستغرق ذلك عادةً من خمس إلى عشر دقائق، ويمكنك إغلاق الصفحة.",
        )}
      </p>
      <div aria-hidden="true" className="mt-4 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={clsx("h-2 rounded-full", i < daysReady ? "bg-brand-purple-900" : "bg-brand-tint")}
          />
        ))}
      </div>
      <p className="mt-2 text-base font-extrabold text-brand-ink">
        {daysReady > 0 ? `${arNum(daysReady)} من ٧ أيام جاهزة` : "نحسب الأهداف ونختار أطباق الأسبوع"}
      </p>
      {daysReady > 0 && (
        <ButtonLink href="/plan" variant="secondary" className="mt-3">
          عرض ما جهز حتى الآن
        </ButtonLink>
      )}
      <GeneratingPlanWatcher />
    </Card>
  );
}
