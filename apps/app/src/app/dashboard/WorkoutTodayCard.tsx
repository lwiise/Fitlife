import Link from "next/link";
import { clsx } from "clsx";
import { AlertTriangle, Check, ChevronLeft, Dumbbell, Loader2, Moon } from "lucide-react";
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

/**
 * Today's session for the account owner, as one row that opens the session
 * (marking and the intensity question live there, not on the home screen).
 */
export function WorkoutTodayCard({
  today,
  ownerSex,
}: {
  today: WorkoutToday;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  const eyebrow = g("تمرينكِ اليوم", "تمرينك اليوم");
  let Icon = Dumbbell;
  let ok = false;
  let title: string;
  let meta: React.ReactNode = null;
  let cta: string | null = null;

  switch (today.kind) {
    case "generating":
      Icon = Loader2;
      title = g("نجهّز برنامج تمارينكِ", "نجهّز برنامج تمارينك");
      meta = today.waitingForMeals
        ? g("نجهّز وجباتكِ أولاً، ثم البرنامج", "نجهّز وجباتك أولاً، ثم البرنامج")
        : "يستغرق ذلك عادةً بضع دقائق";
      cta = "متابعة الحالة";
      break;
    case "failed":
      Icon = AlertTriangle;
      title = "لم يكتمل إعداد البرنامج";
      meta = "آخر محاولة لم تنجح";
      cta = "إعادة المحاولة";
      break;
    case "rest":
      Icon = Moon;
      title = "يوم راحة";
      meta = today.nextName ? `الحصة القادمة: ${today.nextName}` : null;
      break;
    case "session":
      ok = today.done;
      if (ok) Icon = Check;
      title = today.done ? `${g("أنجزتِ", "أنجزتَ")} ${today.name}` : today.name;
      meta = (
        <>
          {countAr(today.minutes, MINUTE_FORMS, arNum)}
          <i className="sep" aria-hidden="true" />
          {countAr(today.exercises, EXERCISE_FORMS, arNum)}
        </>
      );
      cta = today.done ? g("اعرضي الحصة", "اعرض الحصة") : g("ابدئي الحصة", "ابدأ الحصة");
      break;
  }

  return (
    <Link href="/plan?view=workout" className="kt-gym">
      <span className={clsx("kt-gym-ico", ok && "ok")}>
        <Icon
          className={clsx("i", today.kind === "generating" && "animate-spin motion-reduce:animate-none")}
          aria-hidden="true"
        />
      </span>
      <span className="kt-gym-t">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </span>
      {cta && (
        <span className="kt-pill">
          {cta}
          <ChevronLeft className="i" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
