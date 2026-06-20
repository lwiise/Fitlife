"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
} from "@/lib/plans/medicalConditions";
import type { UserGoal } from "@/lib/plans/goalMapping";
import { ACTIVITY_OPTIONS, GOALS } from "../labels";
import { saveMomHealthInfo } from "../actions";

type PregStatus = "none" | "pregnant" | "lactating";
type ActivityValue = (typeof ACTIVITY_OPTIONS)[number]["value"];

export type HealthInitial = {
  activity_level: string | null;
  user_goal: UserGoal | undefined;
  pregnancy_status: PregStatus;
  trimester: number | null;
  high_risk_pregnancy: boolean;
  months_postpartum: number | null;
  allergies: string[];
  dislikes: string[];
  conditions: string[];
  other_condition: string;
  consulted_doctor: boolean;
  meal_mode: "shared" | "independent";
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

export function HealthEditForm({ initial }: { initial: HealthInitial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityValue | "">(
    (initial.activity_level as ActivityValue | null) ?? "",
  );
  const [userGoal, setUserGoal] = useState<UserGoal | "">(initial.user_goal ?? "");
  const [pregStatus, setPregStatus] = useState<PregStatus>(initial.pregnancy_status);
  const [trimester, setTrimester] = useState<number | null>(initial.trimester);
  const [highRisk, setHighRisk] = useState<boolean | null>(
    initial.pregnancy_status === "pregnant" ? initial.high_risk_pregnancy : null,
  );
  const [monthsPP, setMonthsPP] = useState<string>(
    initial.months_postpartum != null ? String(initial.months_postpartum) : "",
  );
  const [allergies, setAllergies] = useState<string[]>(initial.allergies);
  const [dislikes, setDislikes] = useState<string[]>(initial.dislikes);
  const [conditions, setConditions] = useState<string[]>(initial.conditions);
  const [otherCondition, setOtherCondition] = useState(initial.other_condition);
  const [consultedDoctor, setConsultedDoctor] = useState(initial.consulted_doctor);
  const [mealMode, setMealMode] = useState<"shared" | "independent">(
    initial.meal_mode,
  );

  const doctorNeeded = useMemo(
    () =>
      conditions.length > 0 ||
      otherCondition.trim().length > 0 ||
      (pregStatus === "pregnant" && highRisk === true),
    [conditions, otherCondition, pregStatus, highRisk],
  );

  const toggleCondition = (slug: string) =>
    setConditions((s) =>
      s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug],
    );

  const submit = () => {
    setError(null);
    if (!activity) return setError("اختاري مستوى نشاطك");
    if (!userGoal) return setError("اختاري هدفك");
    if (pregStatus === "pregnant" && (trimester == null || highRisk == null))
      return setError("أكملي تفاصيل الحمل");
    if (pregStatus === "lactating" && !monthsPP)
      return setError("اكتبي كم شهر مرّ على الولادة");

    startTransition(async () => {
      const result = await saveMomHealthInfo({
        activity_level: activity as ActivityValue,
        user_goal: userGoal,
        pregnancy_status: pregStatus,
        trimester: pregStatus === "pregnant" ? trimester : null,
        high_risk_pregnancy: pregStatus === "pregnant" ? highRisk === true : false,
        months_postpartum: pregStatus === "lactating" && monthsPP ? Number(monthsPP) : null,
        allergies,
        dislikes,
        conditions,
        other_condition: otherCondition.trim() || undefined,
        consulted_doctor: consultedDoctor,
        meal_mode: mealMode,
      });
      if (!result.ok) return setError(result.error);
      router.push("/profile?edited=health");
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          الصحة والأهداف
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          عدّلي نشاطك وهدفك وحالتك الصحية.
        </p>
      </header>

      {/* النشاط والهدف */}
      <section className="space-y-4">
        <GroupHeading>النشاط والهدف</GroupHeading>

        <div>
          <p className="text-sm font-bold text-brand-ink mb-2">مستوى نشاطك</p>
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
        </div>

        <div>
          <p className="text-sm font-bold text-brand-ink mb-2">هدفك الرئيسي</p>
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
      </section>

      {/* الحمل والرضاعة */}
      <section className="space-y-4">
        <GroupHeading>الحمل والرضاعة</GroupHeading>
        <div className="space-y-2">
          <OptionButton full active={pregStatus === "none"} onClick={() => setPregStatus("none")}>
            لست حامل ولا مرضعة
          </OptionButton>
          <OptionButton full active={pregStatus === "pregnant"} onClick={() => setPregStatus("pregnant")}>
            حامل
          </OptionButton>
          <OptionButton full active={pregStatus === "lactating"} onClick={() => setPregStatus("lactating")}>
            مرضعة
          </OptionButton>
        </div>

        {pregStatus === "pregnant" && (
          <div className="space-y-4 rounded-xl bg-white border border-brand-ink/5 p-4">
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">الثلث الحالي</p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((t) => (
                  <OptionButton key={t} active={trimester === t} onClick={() => setTrimester(t)}>
                    {t === 1 ? "الأول" : t === 2 ? "الثاني" : "الثالث"}
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-brand-ink mb-2">هل حملك يعتبر عالي الخطورة؟</p>
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={highRisk === false} onClick={() => setHighRisk(false)}>
                  لا
                </OptionButton>
                <OptionButton active={highRisk === true} onClick={() => setHighRisk(true)}>
                  نعم
                </OptionButton>
              </div>
            </div>
          </div>
        )}

        {pregStatus === "lactating" && (
          <div className="rounded-xl bg-white border border-brand-ink/5 p-4">
            <label htmlFor="months-pp" className="block text-sm font-bold text-brand-ink mb-2">
              كم شهر مرّ على الولادة؟
            </label>
            <input
              id="months-pp"
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={0}
              max={24}
              value={monthsPP}
              onChange={(e) => setMonthsPP(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            />
          </div>
        )}
      </section>

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
          <p className="text-sm font-bold text-brand-ink mb-2">أكلات ما تحبينها شخصياً؟</p>
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
          تختارين تشاركين وجبات العائلة، أو تكون لك خطة بأطباق خاصة بك.
        </p>
        <div className="space-y-2">
          <OptionButton
            full
            active={mealMode === "shared"}
            onClick={() => setMealMode("shared")}
          >
            وجبات مشتركة مع العائلة
          </OptionButton>
          <OptionButton
            full
            active={mealMode === "independent"}
            onClick={() => setMealMode("independent")}
          >
            خطة مستقلة لي
          </OptionButton>
        </div>
      </section>

      {/* الحالات الصحية */}
      <section className="space-y-4">
        <GroupHeading>الحالات الصحية</GroupHeading>
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

        <div>
          <label htmlFor="other-cond" className="block text-sm font-bold text-brand-ink mb-2">
            حالة أخرى (اختياري)
          </label>
          <input
            id="other-cond"
            type="text"
            value={otherCondition}
            onChange={(e) => setOtherCondition(e.target.value)}
            spellCheck={false}
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
            placeholder="اكتبيها هنا"
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
              أكدت أنني استشرت طبيبي قبل البدء بالخطة
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
          onClick={() => router.push("/profile")}
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
