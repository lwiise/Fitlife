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
import type { MemberType } from "@/app/onboarding/actions";
import { updateMemberHealth } from "../actions";
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
      className={`min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        full ? "w-full text-start" : ""
      } ${
        active
          ? "border-brand-purple-900 bg-brand-purple-900 text-white"
          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
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
}: {
  memberId: string;
  type: MemberType;
  initial: MemberHealthInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [activity, setActivity] = useState<string>(initial.activity_level ?? "");
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
    if ((isAdult || isChild) && !activity) return setError("اختاري مستوى النشاط");
    if (isAdult && !userGoal) return setError("اختاري الهدف الرئيسي");
    if (isPregnant && (trimester == null || highRisk == null))
      return setError("أكملي تفاصيل الحمل");
    if (isLactating && !monthsPP) return setError("اكتبي كم شهر مرّ على الولادة");
    if (doctorNeeded && !consultedDoctor)
      return setError("لازم تأكدي على استشارة الطبيب أولاً");

    startTransition(async () => {
      const result = await updateMemberHealth(memberId, {
        activity_level: (activity || null) as ActivityValue | null,
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
          عدّلي النشاط والهدف والحالة الصحية.
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
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((opt) => {
                  const checked = activity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActivity(opt.value)}
                      aria-pressed={checked}
                      className={`block w-full text-start rounded-2xl border-2 px-4 py-3 transition-colors min-h-[3rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        checked
                          ? "border-brand-purple-900 bg-brand-purple-900/5"
                          : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
                      }`}
                    >
                      <span className="block font-bold text-brand-ink text-sm">{opt.label}</span>
                      <span className="block text-brand-ink-muted text-xs mt-0.5">{opt.sublabel}</span>
                    </button>
                  );
                })}
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
        </section>
      )}

      {/* الرضاعة */}
      {isLactating && (
        <section className="space-y-4">
          <GroupHeading>الرضاعة</GroupHeading>
          <div>
            <label htmlFor="m-pp" className="block text-sm font-bold text-brand-ink mb-2">
              كم شهر مرّ على الولادة؟
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
              isChild ? "مثلاً: ربو" : isLactating ? "مثلاً: حديد، فيتامين د" : "اكتبيها هنا"
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
