"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
  hasGateCondition,
} from "@/lib/plans/medicalConditions";
import type { UserGoal } from "@/lib/plans/goalMapping";
import {
  activityLevelFrom,
  ACTIVITY_LEVEL_LABELS,
  DAY_NATURE_OPTIONS,
  EXERCISE_DAYS_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
  type DayNature,
  type ExerciseDays,
  type ExerciseType,
} from "@/lib/plans/activityLevel";
import type { MemberType } from "@/app/onboarding/actions";
import { updateMemberHealth } from "../actions";
import { genderPick } from "@/lib/copy/gender";
import { WATER_LITERS_OPTIONS, type WaterLiters } from "@/lib/plans/waterOptions";
import {
  ACTIVITY_OPTIONS,
  CHILD_ACTIVITY,
  GOALS,
  SCHOOL,
  PREGNANT_CONDITIONS,
  LACTATING_CONDITIONS,
} from "../labels";

type ActivityValue =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type MemberHealthInitial = {
  activity_level: string | null;
  day_nature: string | null;
  exercise_days: string | null;
  exercise_type: string | null;
  target_weight_kg: number | null;
  water_liters: string | null;
  sleep_hours: number | null;
  medications: string[];
  supplements: string[];
  nausea_foods: string[];
  feeding_mode: string | null;
  user_goal: UserGoal | undefined;
  allergies: string[];
  dislikes: string[];
  conditions: string[];
  other_condition: string;
  consulted_doctor: boolean;
  meal_mode: "shared" | "independent";
  trimester: number | null;
  high_risk_pregnancy: boolean | null;
  months_postpartum: number | null;
  school_meal_handling: string | null;
  picky_eater: boolean;
};

function OptionButton({
  active,
  onClick,
  children,
  full,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        full ? "w-full text-start" : ""
      } ${
        active
          ? "border-brand-purple-900 bg-brand-purple-900/5"
          : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
      }`}
    >
      {children}
    </button>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bold text-lg text-brand-ink border-b border-brand-ink/5 pb-2">
      {children}
    </h2>
  );
}

export function MemberHealthEditForm({
  memberId,
  type,
  initial,
  ownerSex,
}: {
  memberId: string;
  type: MemberType;
  initial: MemberHealthInitial;
  // Account owner's sex → the form addresses the owner ("عدّلي/عدّل").
  ownerSex?: string | null;
}) {
  const router = useRouter();
  const g = genderPick(ownerSex);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [activity, setActivity] = useState<string>(initial.activity_level ?? "");
  const [dayNature, setDayNature] = useState<DayNature | null>(
    (initial.day_nature as DayNature | null) ?? null,
  );
  const [exerciseDays, setExerciseDays] = useState<ExerciseDays | null>(
    (initial.exercise_days as ExerciseDays | null) ?? null,
  );
  const [exerciseType, setExerciseType] = useState<ExerciseType | null>(
    (initial.exercise_type as ExerciseType | null) ?? null,
  );
  const [targetWeight, setTargetWeight] = useState(
    initial.target_weight_kg != null ? String(initial.target_weight_kg) : "",
  );
  const [waterLiters, setWaterLiters] = useState<WaterLiters | null>(
    (initial.water_liters as WaterLiters | null) ?? null,
  );
  const [sleepHours, setSleepHours] = useState(
    initial.sleep_hours != null ? String(initial.sleep_hours) : "",
  );
  const [medications, setMedications] = useState<string[]>(initial.medications);
  const [supplements, setSupplements] = useState<string[]>(initial.supplements);
  const [nauseaFoods, setNauseaFoods] = useState<string[]>(initial.nausea_foods);
  const [feedingMode, setFeedingMode] = useState(initial.feeding_mode ?? "");
  const [userGoal, setUserGoal] = useState<UserGoal | "">(initial.user_goal ?? "");
  const [allergies, setAllergies] = useState<string[]>(initial.allergies);
  const [dislikes, setDislikes] = useState<string[]>(initial.dislikes);
  const [conditions, setConditions] = useState<string[]>(initial.conditions);
  const [otherCondition, setOtherCondition] = useState(initial.other_condition);
  const [consultedDoctor, setConsultedDoctor] = useState(initial.consulted_doctor);
  const [mealMode, setMealMode] = useState<"shared" | "independent">(initial.meal_mode);
  const [trimester, setTrimester] = useState<number | null>(initial.trimester);
  const [highRisk, setHighRisk] = useState<boolean | null>(initial.high_risk_pregnancy);
  const [monthsPP, setMonthsPP] = useState(
    initial.months_postpartum != null ? String(initial.months_postpartum) : "",
  );
  const [schoolMeal, setSchoolMeal] = useState(initial.school_meal_handling ?? "");
  const [pickyEater, setPickyEater] = useState(initial.picky_eater);

  const isAdult = type === "adult";
  const isChild = type === "child";
  const isPregnant = type === "pregnant";
  const isLactating = type === "lactating";

  const toggleCondition = (slug: string) =>
    setConditions((s) =>
      s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug],
    );

  // Same gate as the add wizard: pregnant/lactating always; adults on a gate
  // condition or free-text note; children on a chronic note.
  const doctorNeeded = useMemo(() => {
    if (isPregnant || isLactating) return true;
    if (isAdult) return hasGateCondition(conditions) || otherCondition.trim().length > 0;
    return otherCondition.trim().length > 0;
  }, [isAdult, isPregnant, isLactating, conditions, otherCondition]);

  const submit = () => {
    setError(null);
    if (isChild && !activity) return setError(g("اختاري مستوى النشاط", "اختر مستوى النشاط"));
    if (isAdult && !activity && !(dayNature && exerciseDays))
      return setError(g("أكملي أسئلة النشاط", "أكمل أسئلة النشاط"));
    if (isAdult && dayNature && exerciseDays && exerciseDays !== "none" && !exerciseType)
      return setError(g("اختاري نوع الرياضة", "اختر نوع الرياضة"));
    if (isAdult && !userGoal) return setError(g("اختاري الهدف الرئيسي", "اختر الهدف الرئيسي"));
    if (isPregnant && (trimester == null || highRisk == null))
      return setError(g("أكملي تفاصيل الحمل", "أكمل تفاصيل الحمل"));
    if (isLactating && !monthsPP) return setError(g("اكتبي كم شهراً مضى على الولادة", "اكتب كم شهراً مضى على الولادة"));
    if (doctorNeeded && !consultedDoctor)
      return setError("يلزم تأكيد استشارة الطبيب أولاً");

    startTransition(async () => {
      const result = await updateMemberHealth(memberId, {
        activity_level: (activity || null) as ActivityValue | null,
        day_nature: isAdult ? (dayNature ?? undefined) : undefined,
        exercise_days: isAdult ? (exerciseDays ?? undefined) : undefined,
        exercise_type:
          isAdult && exerciseDays && exerciseDays !== "none" ? exerciseType : null,
        target_weight_kg: isAdult && targetWeight ? Number(targetWeight) : null,
        water_liters: isChild ? null : waterLiters,
        sleep_hours: isAdult && sleepHours ? Number(sleepHours) : null,
        medications: isChild ? [] : medications,
        supplements: isChild ? [] : supplements,
        nausea_foods: isPregnant ? nauseaFoods : [],
        feeding_mode:
          isLactating && feedingMode
            ? (feedingMode as "exclusive" | "mixed" | "formula")
            : null,
        user_goal: isAdult ? (userGoal as UserGoal) : undefined,
        allergies,
        dislikes,
        conditions: isChild ? [] : conditions,
        other_condition: otherCondition.trim() || undefined,
        consulted_doctor: consultedDoctor,
        meal_mode: mealMode,
        trimester: isPregnant ? trimester : null,
        high_risk_pregnancy: isPregnant ? highRisk === true : false,
        months_postpartum: isLactating && monthsPP ? Number(monthsPP) : null,
        school_meal_handling: isChild
          ? ((schoolMeal || null) as "home_packed" | "school_provided" | "mixed" | null)
          : null,
        picky_eater: isChild ? pickyEater : false,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/family/edit/${memberId}?edited=health`);
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          الصحة والأهداف
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          {g("عدّلي النشاط والهدف والحالة الصحية.", "عدّل النشاط والهدف والحالة الصحية.")}
        </p>
      </header>

      {/* النشاط والهدف */}
      {(isAdult || isChild) && (
        <section className="space-y-4">
          <GroupHeading>النشاط والهدف</GroupHeading>

          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">مستوى النشاط</p>
            {isChild ? (
              <div className="grid grid-cols-3 gap-2">
                {CHILD_ACTIVITY.map((a) => (
                  <OptionButton
                    key={a.value}
                    active={activity === a.value}
                    onClick={() => setActivity(a.value)}
                  >
                    {a.label}
                  </OptionButton>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">طبيعة اليوم</p>
                  <div className="space-y-2">
                    {DAY_NATURE_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        full
                        active={dayNature === opt.value}
                        onClick={() => setDayNature(opt.value)}
                      >
                        {opt.label}
                        <span className="block text-xs font-medium text-brand-ink-muted mt-0.5">
                          {opt.sublabel}
                        </span>
                      </OptionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">ممارسة الرياضة</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXERCISE_DAYS_OPTIONS.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        active={exerciseDays === opt.value}
                        onClick={() => {
                          setExerciseDays(opt.value);
                          if (opt.value === "none") setExerciseType(null);
                        }}
                      >
                        {opt.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>
                {exerciseDays && exerciseDays !== "none" && (
                  <div>
                    <p className="text-sm font-bold text-brand-ink mb-2">نوع الرياضة</p>
                    <div className="grid grid-cols-3 gap-2">
                      {EXERCISE_TYPE_OPTIONS.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          active={exerciseType === opt.value}
                          onClick={() => setExerciseType(opt.value)}
                        >
                          {opt.label}
                        </OptionButton>
                      ))}
                    </div>
                  </div>
                )}
                {dayNature && exerciseDays ? (
                  <p className="text-sm text-brand-ink-muted leading-relaxed rounded-xl bg-white border border-brand-ink/5 px-4 py-3">
                    مستوى النشاط المحتسب:{" "}
                    <span className="font-bold text-brand-ink">
                      {ACTIVITY_LEVEL_LABELS[activityLevelFrom(dayNature, exerciseDays)]}
                    </span>
                  </p>
                ) : activity ? (
                  <p className="text-sm text-brand-ink-muted leading-relaxed rounded-xl bg-white border border-brand-ink/5 px-4 py-3">
                    المستوى الحالي المسجل:{" "}
                    <span className="font-bold text-brand-ink">
                      {ACTIVITY_OPTIONS.find((o) => o.value === activity)?.label ?? activity}
                    </span>
                    {" — "}{g("أجيبي عن السؤالين أعلاه لتحديثه.", "أجب عن السؤالين أعلاه لتحديثه.")}
                  </p>
                ) : null}
                <div>
                  <label htmlFor="m-target-w" className="block text-sm font-bold text-brand-ink mb-2">
                    الوزن المستهدف (كجم، اختياري)
                  </label>
                  <input
                    id="m-target-w"
                    type="number"
                    inputMode="decimal"
                    dir="ltr"
                    min={20}
                    max={300}
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  />
                </div>
              </div>
            )}
          </div>

          {isAdult && (
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">الهدف الرئيسي</p>
              <div className="space-y-2">
                {GOALS.map((g) => (
                  <OptionButton
                    key={g.value}
                    full
                    active={userGoal === g.value}
                    onClick={() => setUserGoal(g.value)}
                  >
                    {g.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* المدرسة (طفل) */}
      {isChild && (
        <section className="space-y-4">
          <GroupHeading>المدرسة</GroupHeading>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">كيف يأكل الطفل في المدرسة؟</p>
            <div className="space-y-2">
              {SCHOOL.map((s) => (
                <OptionButton
                  key={s.value}
                  full
                  active={schoolMeal === s.value}
                  onClick={() => setSchoolMeal(s.value)}
                >
                  {s.label}
                </OptionButton>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">هل الطفل صعب في الأكل؟</p>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton active={pickyEater === false} onClick={() => setPickyEater(false)}>
                لا
              </OptionButton>
              <OptionButton active={pickyEater === true} onClick={() => setPickyEater(true)}>
                نعم
              </OptionButton>
            </div>
          </div>
        </section>
      )}

      {/* الحمل */}
      {isPregnant && (
        <section className="space-y-4">
          <GroupHeading>الحمل</GroupHeading>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">الثلث الحالي من الحمل</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((t) => (
                <OptionButton key={t} active={trimester === t} onClick={() => setTrimester(t)}>
                  {t === 1 ? "الأول" : t === 2 ? "الثاني" : "الثالث"}
                </OptionButton>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">هل الحمل عالي الخطورة؟</p>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton active={highRisk === false} onClick={() => setHighRisk(false)}>
                لا
              </OptionButton>
              <OptionButton active={highRisk === true} onClick={() => setHighRisk(true)}>
                نعم
              </OptionButton>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">
              أطعمة تسبب لها الغثيان حالياً (اختياري)
            </p>
            <ChipInput
              value={nauseaFoods}
              onChange={setNauseaFoods}
              disabled={isPending}
              placeholder="مثلاً: بيض، دجاج"
            />
          </div>
        </section>
      )}

      {/* الرضاعة */}
      {isLactating && (
        <section className="space-y-4">
          <GroupHeading>الرضاعة</GroupHeading>
          <div>
            <label htmlFor="m-pp" className="block text-sm font-bold text-brand-ink mb-2">
              كم شهراً مضى على الولادة؟
            </label>
            <input
              id="m-pp"
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={0}
              max={24}
              value={monthsPP}
              onChange={(e) => setMonthsPP(e.target.value)}
              disabled={isPending}
              className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">طريقة الرضاعة</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "exclusive", label: "طبيعية كاملة" },
                { value: "mixed", label: "مختلطة" },
                { value: "formula", label: "صناعية" },
              ].map((f) => (
                <OptionButton
                  key={f.value}
                  active={feedingMode === f.value}
                  onClick={() => setFeedingMode(f.value)}
                >
                  {f.label}
                </OptionButton>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* الحساسيات */}
      <section className="space-y-4">
        <GroupHeading>الحساسيات</GroupHeading>
        <div>
          <p className="text-sm font-bold text-brand-ink mb-2">حساسية من أكل معين؟</p>
          <ChipInput
            value={allergies}
            onChange={setAllergies}
            disabled={isPending}
            placeholder="مثلاً: مكسرات، روبيان، لاكتوز"
          />
        </div>
        <div>
          <p className="text-sm font-bold text-brand-ink mb-2">أكلات ما يحبها؟</p>
          <ChipInput
            value={dislikes}
            onChange={setDislikes}
            disabled={isPending}
            placeholder="مثلاً: كبدة، باذنجان"
          />
        </div>
      </section>

      {/* الأدوية والمكملات + نمط اليوم */}
      {!isChild && (
        <section className="space-y-4">
          <GroupHeading>الأدوية والمكملات</GroupHeading>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">أدوية مستخدمة بانتظام (اختياري)</p>
            <ChipInput
              value={medications}
              onChange={setMedications}
              disabled={isPending}
              placeholder="مثلاً: ميتفورمين"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink mb-2">مكملات غذائية (اختياري)</p>
            <ChipInput
              value={supplements}
              onChange={setSupplements}
              disabled={isPending}
              placeholder="مثلاً: حديد، فيتامين د"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">كم لتر ماء يومياً؟</p>
              <div className="grid grid-cols-2 gap-2">
                {WATER_LITERS_OPTIONS.map((o) => (
                  <OptionButton
                    key={o.value}
                    active={waterLiters === o.value}
                    onClick={() =>
                      setWaterLiters((cur) => (cur === o.value ? null : o.value))
                    }
                  >
                    {o.label}
                  </OptionButton>
                ))}
              </div>
            </div>
            {isAdult && (
              <div>
                <label htmlFor="m-sleep" className="block text-sm font-bold text-brand-ink mb-2">
                  ساعات النوم
                </label>
                <input
                  id="m-sleep"
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={2}
                  max={16}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* نمط الوجبات */}
      <section className="space-y-3">
        <GroupHeading>نمط الوجبات</GroupHeading>
        <p className="text-brand-ink-muted text-sm leading-relaxed">
          وجبات مشتركة مع العائلة، أو خطة مستقلة بأطباق خاصة بهذا الفرد.
        </p>
        <div className="space-y-2">
          <OptionButton full active={mealMode === "shared"} onClick={() => setMealMode("shared")}>
            وجبات مشتركة مع العائلة
          </OptionButton>
          <OptionButton
            full
            active={mealMode === "independent"}
            onClick={() => setMealMode("independent")}
          >
            خطة مستقلة لهذا الفرد
          </OptionButton>
        </div>
      </section>

      {/* الحالات الصحية */}
      <section className="space-y-4">
        <GroupHeading>الحالات الصحية</GroupHeading>

        {isAdult && (
          <div className="flex flex-wrap gap-2">
            {[...GATE_CONDITIONS, ...STABLE_CONDITIONS].map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleCondition(c.slug)}
                aria-pressed={conditions.includes(c.slug)}
                className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                  conditions.includes(c.slug)
                    ? "border-brand-pink bg-brand-pink-light text-brand-pink"
                    : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
                }`}
              >
                {c.label_ar}
              </button>
            ))}
          </div>
        )}

        {(isPregnant || isLactating) && (
          <div className="flex flex-wrap gap-2">
            {(isPregnant ? PREGNANT_CONDITIONS : LACTATING_CONDITIONS).map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleCondition(c.slug)}
                aria-pressed={conditions.includes(c.slug)}
                className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                  conditions.includes(c.slug)
                    ? "border-brand-pink bg-brand-pink-light text-brand-pink"
                    : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
                }`}
              >
                {c.label_ar}
              </button>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="m-other" className="block text-sm font-bold text-brand-ink mb-2">
            {isChild
              ? "أي حالة صحية مزمنة عند الطفل؟ (اختياري)"
              : isLactating
                ? "تأخذين فيتامينات أو مكملات؟ (اختياري)"
                : "حالة أخرى (اختياري)"}
          </label>
          <input
            id="m-other"
            type="text"
            value={otherCondition}
            onChange={(e) => setOtherCondition(e.target.value)}
            disabled={isPending}
            spellCheck={false}
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            placeholder={
              isChild ? "مثلاً: ربو" : isLactating ? "مثلاً: حديد، فيتامين د" : g("اكتبيها هنا", "اكتبها هنا")
            }
          />
        </div>

        {doctorNeeded && (
          <label className="flex items-start gap-3 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consultedDoctor}
              onChange={(e) => setConsultedDoctor(e.target.checked)}
              className="mt-1 size-5 rounded accent-brand-purple-900"
            />
            <span className="text-brand-ink text-sm leading-relaxed font-medium">
              أكدت استشارة الطبيب قبل البدء بالخطة
            </span>
          </label>
        )}
      </section>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button
          type="button"
          onClick={() => router.push(`/family/edit/${memberId}`)}
          disabled={isPending}
          className="inline-flex items-center justify-center min-h-11 px-5 py-2.5 rounded-full border border-brand-ink/10 text-brand-ink hover:bg-white text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-full bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          {isPending && (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          حفظ
        </button>
      </div>
    </div>
  );
}
