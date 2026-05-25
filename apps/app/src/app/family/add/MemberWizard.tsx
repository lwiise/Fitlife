"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
  hasGateCondition,
} from "@/lib/plans/medicalConditions";
import type { UserGoal } from "@/lib/plans/goalMapping";
import {
  addFamilyMember,
  updateFamilyMember,
  type FamilyMemberInput,
  type MemberType,
} from "@/app/onboarding/actions";

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

const FEEDING: { value: string; label: string }[] = [
  { value: "exclusive", label: "طبيعية كاملة" },
  { value: "mixed", label: "مختلطة" },
  { value: "formula", label: "صناعية" },
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

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-brand-ink mb-2">
        {label}
      </label>
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
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-brand-ink mb-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      />
    </div>
  );
}

const TYPE_TITLES: Record<MemberType, string> = {
  adult: "إضافة فرد بالغ",
  child: "إضافة طفل",
  pregnant: "إضافة فرد (حامل)",
  lactating: "إضافة فرد (مرضعة)",
};

export interface MemberWizardInitial extends Partial<FamilyMemberInput> {}

export function MemberWizard({
  type,
  role,
  editMemberId,
  initial,
}: {
  type: MemberType;
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [polling, setPolling] = useState(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [birthYear, setBirthYear] = useState(initial?.birth_year?.toString() ?? "");
  const [sex, setSex] = useState<string>(
    initial?.sex ?? (role === "dad" ? "male" : type === "adult" ? "" : "female"),
  );
  const [heightCm, setHeightCm] = useState(initial?.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(initial?.weight_kg?.toString() ?? "");
  const [activity, setActivity] = useState(initial?.activity_level ?? "");
  const [userGoal, setUserGoal] = useState<UserGoal | "">(initial?.user_goal ?? "");
  const [allergies, setAllergies] = useState<string[]>(initial?.allergies ?? []);
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);
  const [otherCondition, setOtherCondition] = useState(initial?.other_condition ?? "");
  const [schoolMeal, setSchoolMeal] = useState(initial?.school_meal_handling ?? "");
  const [pickyEater, setPickyEater] = useState(!!initial?.picky_eater);
  const [trimester, setTrimester] = useState<number | null>(initial?.trimester ?? null);
  const [highRisk, setHighRisk] = useState<boolean | null>(
    initial?.high_risk_pregnancy ?? null,
  );
  const [monthsPP, setMonthsPP] = useState(initial?.months_postpartum?.toString() ?? "");
  const [feedingMode, setFeedingMode] = useState("");
  const [consultedDoctor, setConsultedDoctor] = useState(!!initial?.consulted_doctor);

  const toggleCondition = (slug: string) =>
    setConditions((s) => (s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug]));

  // Step sequence per type. Doctor step is appended only when needed.
  const baseSteps: string[] = useMemo(() => {
    switch (type) {
      case "adult":
        // Husband is male by default — no gender question.
        return role === "dad"
          ? ["identity", "physical", "activity", "goal", "allergies", "medical"]
          : ["identity", "sex", "physical", "activity", "goal", "allergies", "medical"];
      case "child":
        return ["identity", "sex", "physical", "childActivity", "school", "picky", "allergies", "chronic"];
      case "pregnant":
        return ["identity", "physical", "trimester", "highRisk", "pregConditions", "allergies", "nausea"];
      case "lactating":
        return ["identity", "physical", "monthsPP", "feeding", "lactConditions", "allergies", "supplements"];
    }
  }, [type, role]);

  const doctorNeeded = useMemo(() => {
    if (type === "pregnant" || type === "lactating") return true;
    if (type === "adult")
      return hasGateCondition(conditions) || otherCondition.trim().length > 0;
    // child: free-text chronic condition requires consult
    return otherCondition.trim().length > 0;
  }, [type, conditions, otherCondition]);

  const steps = useMemo(
    () => (doctorNeeded ? [...baseSteps, "doctor"] : baseSteps),
    [baseSteps, doctorNeeded],
  );
  const total = steps.length;
  const key = steps[step]!;

  const goNext = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, total - 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const assemble = (): FamilyMemberInput => ({
    member_type: type,
    // Children map to son/daughter by sex so the family summary reads naturally.
    role: type === "child" ? (sex === "male" ? "son" : "daughter") : role,
    name: name.trim(),
    birth_year: Number(birthYear),
    sex: sex || null,
    height_cm: heightCm ? Number(heightCm) : null,
    weight_kg: weightKg ? Number(weightKg) : null,
    activity_level: type === "child" ? activity || null : activity || null,
    user_goal: type === "adult" ? (userGoal as UserGoal) : undefined,
    allergies,
    dislikes: [],
    conditions:
      type === "child"
        ? []
        : type === "pregnant" || type === "lactating"
          ? conditions
          : conditions,
    other_condition: otherCondition.trim() || undefined,
    consulted_doctor: doctorNeeded ? consultedDoctor : false,
    school_meal_handling: type === "child" ? schoolMeal || null : null,
    picky_eater: type === "child" ? pickyEater : false,
    trimester: type === "pregnant" ? trimester : null,
    high_risk_pregnancy: type === "pregnant" ? highRisk === true : false,
    months_postpartum: type === "lactating" ? (monthsPP ? Number(monthsPP) : null) : null,
  });

  const submit = () => {
    const input = assemble();
    if (!input.name || input.name.length < 2) return setError("اكتبي الاسم");
    if (!input.birth_year) return setError("اكتبي سنة الميلاد");
    startTransition(async () => {
      const result = editMemberId
        ? await updateFamilyMember(editMemberId, input)
        : await addFamilyMember(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // No regeneration happened (e.g. cosmetic edit) → go straight to the plan.
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

  // Advance from the final base step: to doctor if needed, else submit.
  const advanceOrSubmit = () => {
    if (step < total - 1) goNext();
    else submit();
  };

  const isLastBeforeDoctor = step === baseSteps.length - 1;
  const nextLabel =
    isLastBeforeDoctor && !doctorNeeded ? "أنشئي الخطة" : "التالي";

  if (polling) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
        <Loader2 className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900" aria-hidden="true" />
        <p className="text-brand-ink font-bold text-lg">
          جاري تحديث خطط العائلة بعد إضافة {name}…
        </p>
        <p className="text-brand-ink-muted text-sm">قد تاخذ دقيقة</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base text-brand-ink">{TYPE_TITLES[type]}</h1>
            <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
              {step + 1} / {total}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={total}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${((step + 1) / total) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-6"
          >
            {key === "identity" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    الاسم وسنة الميلاد
                  </h2>
                </header>
                <TextField id="m-name" label="الاسم" value={name} onChange={setName} placeholder="مثلاً: خالد" />
                <NumberField id="m-by" label="سنة الميلاد" value={birthYear} onChange={setBirthYear} placeholder="1988" />
                <PrimaryButton onClick={() => (name.trim().length >= 2 && birthYear ? goNext() : setError("أكملي الاسم وسنة الميلاد"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "sex" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الجنس</h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  <OptionButton active={sex === "male"} onClick={() => setSex("male")}>ذكر</OptionButton>
                  <OptionButton active={sex === "female"} onClick={() => setSex("female")}>أنثى</OptionButton>
                </div>
                <PrimaryButton onClick={() => (sex ? goNext() : setError("اختاري الجنس"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "physical" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    {type === "pregnant" ? "الطول والوزن قبل الحمل" : "الطول والوزن"}
                  </h2>
                  {type === "child" && (
                    <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
                      نستخدمها للسياق العام فقط، خطة الطفل بالحصص لا بالسعرات.
                    </p>
                  )}
                </header>
                <NumberField id="m-h" label="الطول (سم)" value={heightCm} onChange={setHeightCm} placeholder="120" />
                <NumberField id="m-w" label="الوزن (كجم)" value={weightKg} onChange={setWeightKg} placeholder="40" />
                <PrimaryButton onClick={() => (heightCm && weightKg ? goNext() : setError("أكملي الطول والوزن"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "activity" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">مستوى النشاط</h2>
                </header>
                <div className="space-y-2">
                  {ADULT_ACTIVITY.map((a) => (
                    <OptionButton key={a.value} full active={activity === a.value} onClick={() => setActivity(a.value)}>{a.label}</OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (activity ? goNext() : setError("اختاري مستوى النشاط"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "childActivity" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">مستوى نشاط الطفل</h2>
                </header>
                <div className="grid grid-cols-3 gap-2">
                  {CHILD_ACTIVITY.map((a) => (
                    <OptionButton key={a.value} active={activity === a.value} onClick={() => setActivity(a.value)}>{a.label}</OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (activity ? goNext() : setError("اختاري مستوى النشاط"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "goal" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الهدف الرئيسي</h2>
                </header>
                <div className="space-y-2">
                  {GOALS.map((g) => (
                    <OptionButton key={g.value} full active={userGoal === g.value} onClick={() => setUserGoal(g.value)}>{g.label}</OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (userGoal ? goNext() : setError("اختاري الهدف"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "school" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">كيف يأكل الطفل في المدرسة؟</h2>
                </header>
                <div className="space-y-2">
                  {SCHOOL.map((s) => (
                    <OptionButton key={s.value} full active={schoolMeal === s.value} onClick={() => setSchoolMeal(s.value)}>{s.label}</OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (schoolMeal ? goNext() : setError("اختاري طريقة الأكل في المدرسة"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "picky" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">هل الطفل صعب في الأكل؟</h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  <OptionButton active={pickyEater === false} onClick={() => setPickyEater(false)}>لا</OptionButton>
                  <OptionButton active={pickyEater === true} onClick={() => setPickyEater(true)}>نعم</OptionButton>
                </div>
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {key === "trimester" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الثلث الحالي من الحمل</h2>
                </header>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((t) => (
                    <OptionButton key={t} active={trimester === t} onClick={() => setTrimester(t)}>
                      {t === 1 ? "الأول" : t === 2 ? "الثاني" : "الثالث"}
                    </OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (trimester ? goNext() : setError("اختاري الثلث"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "highRisk" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">هل الحمل عالي الخطورة؟</h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  <OptionButton active={highRisk === false} onClick={() => setHighRisk(false)}>لا</OptionButton>
                  <OptionButton active={highRisk === true} onClick={() => setHighRisk(true)}>نعم</OptionButton>
                </div>
                <PrimaryButton onClick={() => (highRisk == null ? setError("اختاري") : goNext())}>التالي</PrimaryButton>
              </>
            )}

            {key === "monthsPP" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">كم شهر مرّ على الولادة؟</h2>
                </header>
                <NumberField id="m-pp" label="عدد الأشهر" value={monthsPP} onChange={setMonthsPP} placeholder="3" />
                <PrimaryButton onClick={() => (monthsPP ? goNext() : setError("اكتبي عدد الأشهر"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "feeding" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">طريقة الرضاعة</h2>
                </header>
                <div className="space-y-2">
                  {FEEDING.map((f) => (
                    <OptionButton key={f.value} full active={feedingMode === f.value} onClick={() => setFeedingMode(f.value)}>{f.label}</OptionButton>
                  ))}
                </div>
                <PrimaryButton onClick={() => (feedingMode ? goNext() : setError("اختاري طريقة الرضاعة"))}>التالي</PrimaryButton>
              </>
            )}

            {(key === "pregConditions" || key === "lactConditions") && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">أي حالة صحية؟</h2>
                </header>
                <div className="flex flex-wrap gap-2">
                  {(key === "pregConditions" ? PREGNANT_CONDITIONS : LACTATING_CONDITIONS).map((c) => (
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
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {key === "allergies" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الحساسيات الغذائية</h2>
                  <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">اكتبي أي حساسية باسمها.</p>
                </header>
                <ChipInput value={allergies} onChange={setAllergies} disabled={isPending} placeholder="مثلاً: مكسرات، روبيان" />
                <PrimaryButton onClick={advanceOrSubmit} isPending={isPending && key !== "allergies"}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "medical" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الحالات الصحية</h2>
                </header>
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
                <TextField id="m-other" label="حالة أخرى (اختياري)" value={otherCondition} onChange={setOtherCondition} placeholder="اكتبيها هنا" />
                <PrimaryButton onClick={advanceOrSubmit} isPending={isPending && !doctorNeeded}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "chronic" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">أي حالة صحية مزمنة عند الطفل؟</h2>
                  <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">اتركيها فارغة إذا ما فيه.</p>
                </header>
                <TextField id="m-chronic" label="الحالة (اختياري)" value={otherCondition} onChange={setOtherCondition} placeholder="مثلاً: ربو" />
                <PrimaryButton onClick={advanceOrSubmit} isPending={isPending && !doctorNeeded}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "nausea" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">أكلات تسبب لك غثيان حالياً؟</h2>
                </header>
                <ChipInput value={allergies} onChange={setAllergies} disabled={isPending} placeholder="اكتبيها، أو تجاوزي" />
                <PrimaryButton onClick={advanceOrSubmit}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "supplements" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">تأخذين فيتامينات أو مكملات؟</h2>
                </header>
                <TextField id="m-supp" label="المكملات (اختياري)" value={otherCondition} onChange={setOtherCondition} placeholder="مثلاً: حديد، فيتامين د" />
                <PrimaryButton onClick={advanceOrSubmit}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "doctor" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">استشارة الطبيب</h2>
                  <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
                    لسلامة هذا الفرد، نتأكد إنه استشار الطبيب قبل البدء بالخطة.
                  </p>
                </header>
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
                <PrimaryButton
                  onClick={() => (consultedDoctor ? submit() : setError("لازم تأكدي على استشارة الطبيب أولاً"))}
                  isPending={isPending}
                >
                  أنشئي الخطة
                </PrimaryButton>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isPending}
            className="mt-6 inline-flex items-center gap-1 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            رجوع
          </button>
        )}
      </div>
    </main>
  );
}

function PrimaryButton({
  onClick,
  isPending,
  children,
}: {
  onClick: () => void;
  isPending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      {isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
}
