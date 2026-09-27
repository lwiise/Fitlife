import { Dumbbell, Moon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { countAr, EXERCISE_FORMS, MINUTE_FORMS } from "@/lib/copy/plural";

export type WorkoutToday =
  | { kind: "generating"; waitingForMeals: boolean }
  | { kind: "failed" }
  | { kind: "rest"; nextName: string | null }
  | {
      kind: "session";
      name: string;
      minutes: number;
      exercises: number;
      done: boolean;
    };

/** Today's session for the account owner, or a one-line rest day. */
export function WorkoutTodayCard({
  today,
  ownerSex,
}: {
  today: WorkoutToday;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  const Icon = today.kind === "rest" ? Moon : Dumbbell;
  let title: string;
  let meta: string | null = null;
  let cta: string | null = g("اعرضي التمارين", "اعرض التمارين");

  switch (today.kind) {
    case "generating":
      title = "نجهّز برنامج تمارينك";
      meta = today.waitingForMeals
        ? "نجهّز وجباتك أولاً، ثم البرنامج."
        : "يستغرق ذلك عادةً بضع دقائق.";
      cta = "متابعة الحالة";
      break;
    case "failed":
      title = "لم يكتمل إعداد برنامج التمارين";
      meta = "آخر محاولة لم تنجح، ويمكن إعادتها من صفحة التمارين.";
      cta = "إعادة المحاولة";
      break;
    case "rest":
      title = "اليوم يوم راحة";
      meta = today.nextName ? `الحصة القادمة: ${today.nextName}` : null;
      break;
    case "session":
      title = `تمرين اليوم: ${today.name}`;
      meta = `${countAr(today.minutes, MINUTE_FORMS, arNum)} · ${countAr(today.exercises, EXERCISE_FORMS, arNum)}`;
      cta = today.done ? g("اعرضي الحصة", "اعرض الحصة") : g("ابدئي التمرين", "ابدأ التمرين");
      break;
  }

  return (
    <Card aria-labelledby="workout-today-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-tint text-brand-purple-900">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="workout-today-title" className="text-app-item text-brand-ink">
            {title}
          </h2>
          {meta && <p className="mt-0.5 text-meta text-brand-ink-muted">{meta}</p>}
          {today.kind === "session" && today.done && (
            <p className="mt-1 text-meta font-bold text-success">
              {g("أنجزتِ حصة اليوم", "أنجزتَ حصة اليوم")}
            </p>
          )}
        </div>
      </div>
      {cta && (
        <ButtonLink href="/plan?view=workout" variant="secondary" className="mt-3">
          {cta}
        </ButtonLink>
      )}
    </Card>
  );
}
