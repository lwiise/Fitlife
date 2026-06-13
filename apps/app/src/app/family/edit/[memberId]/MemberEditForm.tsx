"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { BackToDashboard } from "@/components/BackToDashboard";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
  hasGateCondition,
} from "@/lib/plans/medicalConditions";
import type { UserGoal } from "@/lib/plans/goalMapping";
import {
  updateFamilyMember,
  type FamilyMemberInput,
  type MemberType,
} from "@/app/onboarding/actions";
import type { MemberWizardInitial } from "../../add/MemberWizard";

// Label sets mirror MemberWizard.tsx — kept in sync by hand. The edit form shows
// every field for the member's type on one page instead of one-per-step.
const GOALS: { value: UserGoal; label: string }[] = [
  { value: "lose_weight", label: "نزول الوزن" },
  { value: "maintain_health", label: "الحفاظ على الوزن وتحسين الصحة" },
  { value: "build_muscle", label: "بناء عضل وزيادة قوة" },
  { value: "athletic", label: "تحسين الأداء الرياضي" },
  { value: "manage_condition", label: "إدارة حالة صحية" },
];

const ADULT_ACTIVITY: { value: string; label: string }[] = [
  { value: "sedentary", label: "قليلة الحركة" },
  { value: "light", label: "نشاط خفيف" },
  { value: "moderate", label: "نشاط متوسط" },
  { value: "active", label: "نشط" },
  { value: "very_active", label: "نشط جداً" },
];

const CHILD_ACTIVITY: { value: string; label: string }[] = [
  { value: "light", label: "قليل" },
  { value: "moderate", label: "متوسط" },
  { value: "active", label: "عالي" },
];

const SCHOOL: { value: string; label: string }[] = [
  { value: "home_packed", label: "وجبة من البيت" },
  { value: "school_provided", label: "من المدرسة" },
  { value: "mixed", label: "مزيج" },
];

const PREGNANT_CONDITIONS = [
  { slug: "gestational_diabetes", label_ar: "سكري الحمل" },
  { slug: "pregnancy_hypertension", label_ar: "ارتفاع ضغط الحمل" },
  { slug: "anemia", label_ar: "الأنيميا" },
];

const LACTATING_CONDITIONS = [
  { slug: "stable_hypothyroid", label_ar: "قصور الغدة الدرقية" },
  { slug: "controlled_hypertension", label_ar: "ارتفاع ضغط مسيطر عليه" },
  { slug: "anemia", label_ar: "الأنيميا" },
];

const TYPE_TITLES: Record<MemberType, string> = {
  adult: "تعديل بيانات فرد بالغ",
  child: "تعديل بيانات طفل",
  pregnant: "تعديل بيانات (حامل)",
  lactating: "تعديل بيانات (مرضعة)",
};

// Mirror the family_members DB check constraints so a typo is caught with a
// friendly Arabic message instead of a raw Postgres "numeric field overflow".
function physicalRangeError(
  height: number | null | undefined,
  weight: number | null | undefined,
): string | null {
  if (height != null && (height < 40 || height > 250))
    return "الطول لازم يكون بين 40 و250 سم";
  if (weight != null && (weight < 5 || weight > 300))
    return "الوزن لازم يكون بين 5 و300 كجم";
  return null;
}

function birthYearError(year: number): string | null {
  const thisYear = new Date().getFullYear();
  if (year < 1940 || year > thisYear)
    return `سنة الميلاد لازم تكون بين 1940 و${thisYear}`;
  return null;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-sm font-bold text-brand-ink mb-2">{label}</span>
      {hint && <p className="text-brand-ink-muted text-xs mb-2 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      dir="ltr"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
    />
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
    />
  );
}

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

function ConditionPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        active
          ? "border-brand-pink bg-brand-pink-light text-brand-pink"
          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-brand-ink/5 shadow-sm p-5 md:p-6 space-y-5">
      <h2 className="font-extrabold text-lg text-brand-ink">{title}</h2>
      {children}
    </section>
  );
}

export function MemberEditForm({
  type,
  role,
  editMemberId,
  initial,
}: {
  type: MemberType;
  role: string;
  editMemberId: string;
  initial: MemberWizardInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [upgrade, setUpgrade] = useState<{ current: number; max: number } | null>(null);

  const [name, setName] = useState(initial.name ?? "");
  const [birthYear, setBirthYear] = useState(initial.birth_year?.toString() ?? "");
  const [sex, setSex] = useState<string>(
    initial.sex ?? (role === "dad" ? "male" : type === "adult" ? "" : "female"),
  );
  const [heightCm, setHeightCm] = useState(initial.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(initial.weight_kg?.toString() ?? "");
  const [activity, setActivity] = useState(initial.activity_level ?? "");
  const [userGoal, setUserGoal] = useState<UserGoal | "">(initial.user_goal ?? "");
  const [allergies, setAllergies] = useState<string[]>(initial.allergies ?? []);
  const [conditions, setConditions] = useState<string[]>(initial.conditions ?? []);
  const [otherCondition, setOtherCondition] = useState(initial.other_condition ?? "");
  const [schoolMeal, setSchoolMeal] = useState(initial.school_meal_handling ?? "");
  const [pickyEater, setPickyEater] = useState(!!initial.picky_eater);
  const [trimester, setTrimester] = useState<number | null>(initial.trimester ?? null);
  const [highRisk, setHighRisk] = useState<boolean | null>(initial.high_risk_pregnancy ?? null);
  const [monthsPP, setMonthsPP] = useState(initial.months_postpartum?.toString() ?? "");
  const [consultedDoctor, setConsultedDoctor] = useState(!!initial.consulted_doctor);
  const [mealMode, setMealMode] = useState<"shared" | "independent">(
    initial.meal_mode ?? "shared",
  );

  const toggleCondition = (slug: string) =>
    setConditions((s) => (s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug]));

  // Same gate logic as the wizard: pregnant/lactating always consult; adult when a
  // gate condition or free-text condition is present; child when a chronic note exists.
  const doctorNeeded = useMemo(() => {
    if (type === "pregnant" || type === "lactating") return true;
    if (type === "adult")
      return hasGateCondition(conditions) || otherCondition.trim().length > 0;
    return otherCondition.trim().length > 0;
  }, [type, conditions, otherCondition]);

  // Identical to MemberWizard.assemble() so the save path behaves the same.
  const assemble = (): FamilyMemberInput => ({
    member_type: type,
    role: type === "child" ? (sex === "male" ? "son" : "daughter") : role,
    name: name.trim(),
    birth_year: Number(birthYear),
    sex: sex || null,
    height_cm: heightCm ? Number(heightCm) : null,
    weight_kg: weightKg ? Number(weightKg) : null,
    activity_level: activity || null,
    user_goal: type === "adult" ? (userGoal as UserGoal) : undefined,
    allergies,
    dislikes: initial.dislikes ?? [],
    conditions: type === "child" ? [] : conditions,
    other_condition: otherCondition.trim() || undefined,
    consulted_doctor: doctorNeeded ? consultedDoctor : false,
    meal_mode: mealMode,
    school_meal_handling: type === "child" ? schoolMeal || null : null,
    picky_eater: type === "child" ? pickyEater : false,
    trimester: type === "pregnant" ? trimester : null,
    high_risk_pregnancy: type === "pregnant" ? highRisk === true : false,
    months_postpartum: type === "lactating" ? (monthsPP ? Number(monthsPP) : null) : null,
  });

  const save = () => {
    const input = assemble();
    if (!input.name || input.name.length < 2) return setError("اكتبي الاسم");
    if (!input.birth_year) return setError("اكتبي سنة الميلاد");
    const rangeError = physicalRangeError(input.height_cm, input.weight_kg);
    if (rangeError) return setError(rangeError);
    const yearError = birthYearError(input.birth_year);
    if (yearError) return setError(yearError);
    if (doctorNeeded && !consultedDoctor)
      return setError("لازم تأكدي على استشارة الطبيب أولاً");

    startTransition(async () => {
      const result = await updateFamilyMember(editMemberId, input);
      if (!result.ok) {
        if ("upgrade_required" in result) {
          setUpgrade({ current: result.current, max: result.max });
          return;
        }
        setError(result.error);
        return;
      }
      // No regeneration (e.g. cosmetic edit) → straight back to the plan.
      if (!result.plan_generation_id) {
        router.push("/plan");
        return;
      }
      // Poll until the regenerated plan is ready, then show it.
      setPolling(true);
      const dest = `/plan?onboarding=member-added&member=${encodeURIComponent(input.name)}`;
      const deadline = Date.now() + 5 * 60 * 1000;
      const tick = async () => {
        try {
          const res = await fetch("/api/plans/status", { cache: "no-store" });
          const body = await res.json();
          if (body.status === "ready" || body.status === "failed" || Date.now() > deadline) {
            router.push(dest);
            return;
          }
        } catch {
          /* keep polling */
        }
        setTimeout(tick, 2500);
      };
      tick();
    });
  };

  if (upgrade) {
    return (
      <main className="min-h-screen bg-brand-surface">
        <div className="container-app py-12 md:py-16 max-w-md">
          <div className="bg-white rounded-3xl border border-brand-ink/5 shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-brand-lavender/40 mb-4">
              <Sparkles className="size-7 text-brand-purple-900" aria-hidden="true" />
            </div>
            <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
              محتاجة باقة أكبر
            </h2>
            <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
              باقتك الحالية تكفي {upgrade.max}، وعائلتك صارت {upgrade.current}. رقّي باقتك
              عشان نجهّز خطط العائلة المنسقة.
            </p>
            <a
              href="/pricing"
              className="mt-6 w-full inline-flex items-center justify-center bg-brand-ink hover:bg-brand-purple-900 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              عرض الباقات
            </a>
            <a
              href="/family"
              className="mt-3 inline-block text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
            >
              رجوع للعائلة
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (polling) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
        <Loader2
          className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900"
          aria-hidden="true"
        />
        <p className="text-brand-ink font-bold text-lg">نحضّر خطة {name}…</p>
        <p className="text-brand-ink-muted text-sm">قد تاخذ دقيقة</p>
      </div>
    );
  }

  const showSex = !(type === "adult" && role === "dad");
  const isPregnant = type === "pregnant";
  const isLactating = type === "lactating";
  const isChild = type === "child";
  const isAdult = type === "adult";

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between gap-2">
          <h1 className="font-bold text-base text-brand-ink truncate">
            {role === "dad" ? "تعديل بيانات الزوج" : TYPE_TITLES[type]}
          </h1>
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-5">
        <Card title="المعلومات الأساسية">
          <Field label="الاسم">
            <TextInput id="m-name" value={name} onChange={setName} placeholder="مثلاً: خالد" />
          </Field>
          <Field label="سنة الميلاد">
            <NumberInput id="m-by" value={birthYear} onChange={setBirthYear} placeholder="1988" />
          </Field>
          {showSex && (
            <Field label="الجنس">
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={sex === "male"} onClick={() => setSex("male")}>
                  ذكر
                </OptionButton>
                <OptionButton active={sex === "female"} onClick={() => setSex("female")}>
                  أنثى
                </OptionButton>
              </div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={isPregnant ? "الطول قبل الحمل (سم)" : "الطول (سم)"}>
              <NumberInput id="m-h" value={heightCm} onChange={setHeightCm} placeholder="120" />
            </Field>
            <Field label={isPregnant ? "الوزن قبل الحمل (كجم)" : "الوزن (كجم)"}>
              <NumberInput id="m-w" value={weightKg} onChange={setWeightKg} placeholder="40" />
            </Field>
          </div>
        </Card>

        {(isAdult || isChild) && (
          <Card title={isChild ? "النشاط والهدف" : "النشاط والهدف"}>
            <Field label="مستوى النشاط" hint="كل ما زاد نشاطه، زادت سعراته.">
              <div className={isChild ? "grid grid-cols-3 gap-2" : "space-y-2"}>
                {(isChild ? CHILD_ACTIVITY : ADULT_ACTIVITY).map((a) => (
                  <OptionButton
                    key={a.value}
                    full={!isChild}
                    active={activity === a.value}
                    onClick={() => setActivity(a.value)}
                  >
                    {a.label}
                  </OptionButton>
                ))}
              </div>
            </Field>
            {isAdult && (
              <Field label="الهدف الرئيسي">
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
              </Field>
            )}
          </Card>
        )}

        {isChild && (
          <Card title="المدرسة">
            <Field label="كيف يأكل الطفل في المدرسة؟">
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
            </Field>
            <Field label="هل الطفل صعب في الأكل؟" hint="نختار أطباق مألوفة ومحبّبة لو كان صعب.">
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={pickyEater === false} onClick={() => setPickyEater(false)}>
                  لا
                </OptionButton>
                <OptionButton active={pickyEater === true} onClick={() => setPickyEater(true)}>
                  نعم
                </OptionButton>
              </div>
            </Field>
          </Card>
        )}

        {isPregnant && (
          <Card title="الحمل">
            <Field label="الثلث الحالي من الحمل">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((t) => (
                  <OptionButton
                    key={t}
                    active={trimester === t}
                    onClick={() => setTrimester(t)}
                  >
                    {t === 1 ? "الأول" : t === 2 ? "الثاني" : "الثالث"}
                  </OptionButton>
                ))}
              </div>
            </Field>
            <Field label="هل الحمل عالي الخطورة؟" hint="لو عالي الخطورة، نطلب استشارة الطبيب.">
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={highRisk === false} onClick={() => setHighRisk(false)}>
                  لا
                </OptionButton>
                <OptionButton active={highRisk === true} onClick={() => setHighRisk(true)}>
                  نعم
                </OptionButton>
              </div>
            </Field>
          </Card>
        )}

        {isLactating && (
          <Card title="الرضاعة">
            <Field label="كم شهر مرّ على الولادة؟" hint="احتياج الرضاعة يختلف حسب المرحلة.">
              <NumberInput id="m-pp" value={monthsPP} onChange={setMonthsPP} placeholder="3" />
            </Field>
          </Card>
        )}

        <Card title="الحساسيات والوجبات">
          <Field label="الحساسيات الغذائية" hint="اكتبي أي حساسية باسمها.">
            <ChipInput
              value={allergies}
              onChange={setAllergies}
              disabled={isPending}
              placeholder="مثلاً: مكسرات، روبيان"
            />
          </Field>
          <Field
            label="نمط الوجبات"
            hint="وجبات مشتركة مع العائلة، أو خطة مستقلة لهذا الفرد؟"
          >
            <div className="grid gap-2">
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
          </Field>
        </Card>

        <Card title="الحالات الصحية">
          {isAdult && (
            <Field label="اختاري اللي ينطبق، أو اتركيها فارغة">
              <div className="flex flex-wrap gap-2">
                {[...GATE_CONDITIONS, ...STABLE_CONDITIONS].map((c) => (
                  <ConditionPill
                    key={c.slug}
                    active={conditions.includes(c.slug)}
                    onClick={() => toggleCondition(c.slug)}
                  >
                    {c.label_ar}
                  </ConditionPill>
                ))}
              </div>
            </Field>
          )}

          {(isPregnant || isLactating) && (
            <Field label="اختاري اللي ينطبق، أو اتركيها فارغة">
              <div className="flex flex-wrap gap-2">
                {(isPregnant ? PREGNANT_CONDITIONS : LACTATING_CONDITIONS).map((c) => (
                  <ConditionPill
                    key={c.slug}
                    active={conditions.includes(c.slug)}
                    onClick={() => toggleCondition(c.slug)}
                  >
                    {c.label_ar}
                  </ConditionPill>
                ))}
              </div>
            </Field>
          )}

          {isAdult && (
            <Field label="حالة أخرى (اختياري)">
              <TextInput
                id="m-other"
                value={otherCondition}
                onChange={setOtherCondition}
                placeholder="اكتبيها هنا"
              />
            </Field>
          )}
          {isChild && (
            <Field label="أي حالة صحية مزمنة عند الطفل؟ (اختياري)">
              <TextInput
                id="m-chronic"
                value={otherCondition}
                onChange={setOtherCondition}
                placeholder="مثلاً: ربو"
              />
            </Field>
          )}
          {isLactating && (
            <Field label="تأخذين فيتامينات أو مكملات؟ (اختياري)">
              <TextInput
                id="m-supp"
                value={otherCondition}
                onChange={setOtherCondition}
                placeholder="مثلاً: حديد، فيتامين د"
              />
            </Field>
          )}

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
        </Card>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            {isPending && (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            حفظ التعديلات
          </button>
          <a
            href="/family"
            className="px-5 py-3.5 rounded-xl border border-brand-ink/10 bg-white text-brand-ink font-bold text-base hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            إلغاء
          </a>
        </div>
      </div>
    </main>
  );
}
