"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { BackToDashboard } from "@/components/BackToDashboard";
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

// Mirror the family_members DB check constraints so a typo is caught with a
// friendly Arabic message instead of a raw Postgres "numeric field overflow"
// (numeric(5,2) overflows before the range check even fires).
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

// Singular noun per type, for the "X من N" counter when adding several at once.
const TYPE_NOUNS: Record<MemberType, string> = {
  adult: "البالغ",
  child: "الطفل",
  pregnant: "الحامل",
  lactating: "المرضعة",
};

export type MemberWizardInitial = Partial<FamilyMemberInput>;

export function MemberWizard({
  type,
  role,
  editMemberId,
  initial,
  onboarding = false,
  count = 1,
  onComplete,
  onSkip,
  terminalLabel,
}: {
  type: MemberType;
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
  // During the onboarding add-a-member loop: generation is deferred (added members
  // are only saved), so on success return to the loop's pop-up instead of /plan.
  onboarding?: boolean;
  // How many members of this type to collect in sequence (1 = single). Only used
  // when adding (never editing); each is saved before the next begins.
  count?: number;
  // When provided (the onboarding family builder), called after all `count` members
  // are saved instead of navigating — lets a parent drive a longer sequence.
  onComplete?: () => void;
  // When provided (the onboarding family builder), renders a "skip for now" escape
  // hatch. The family is optional, so she can bail out of the rest of the sequence
  // and generate the plan now with whoever's already saved, adding the rest later.
  onSkip?: () => void;
  // Label for the very last member's submit button (default "أنشئي الخطة"). The
  // family builder passes "التالي" when more member types still follow.
  terminalLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [polling, setPolling] = useState(false);
  const [upgrade, setUpgrade] = useState<{ current: number; max: number } | null>(null);
  // 0-based position in a multi-member batch (e.g. "الطفل ٢ من ٣").
  const [memberIndex, setMemberIndex] = useState(0);

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
  const [mealMode, setMealMode] = useState<"shared" | "independent">(
    initial?.meal_mode ?? "shared",
  );

  const toggleCondition = (slug: string) =>
    setConditions((s) => (s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug]));

  // Step sequence per type. Doctor step is appended only when needed.
  const baseSteps: string[] = useMemo(() => {
    switch (type) {
      case "adult":
        // Husband is male by default — no gender question.
        return role === "dad"
          ? ["identity", "physical", "activity", "goal", "allergies", "mealMode", "medical"]
          : ["identity", "sex", "physical", "activity", "goal", "allergies", "mealMode", "medical"];
      case "child":
        return ["identity", "sex", "physical", "childActivity", "school", "picky", "allergies", "mealMode", "chronic"];
      case "pregnant":
        return ["identity", "physical", "trimester", "highRisk", "pregConditions", "allergies", "mealMode", "nausea"];
      case "lactating":
        return ["identity", "physical", "monthsPP", "feeding", "lactConditions", "allergies", "mealMode", "supplements"];
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
    // No per-member dislikes UI in this wizard, but preserve any existing ones on
    // edit instead of wiping them (the edit route passes initial.dislikes).
    dislikes: initial?.dislikes ?? [],
    conditions:
      type === "child"
        ? []
        : type === "pregnant" || type === "lactating"
          ? conditions
          : conditions,
    other_condition: otherCondition.trim() || undefined,
    consulted_doctor: doctorNeeded ? consultedDoctor : false,
    meal_mode: mealMode,
    school_meal_handling: type === "child" ? schoolMeal || null : null,
    picky_eater: type === "child" ? pickyEater : false,
    trimester: type === "pregnant" ? trimester : null,
    high_risk_pregnancy: type === "pregnant" ? highRisk === true : false,
    months_postpartum: type === "lactating" ? (monthsPP ? Number(monthsPP) : null) : null,
  });

  // Clear the form for the next member in a multi-member batch (add-mode only, so
  // every field returns to its blank default — mirrors the useState initializers).
  const resetForNext = () => {
    setName("");
    setBirthYear("");
    setSex(role === "dad" ? "male" : type === "adult" ? "" : "female");
    setHeightCm("");
    setWeightKg("");
    setActivity("");
    setUserGoal("");
    setAllergies([]);
    setConditions([]);
    setOtherCondition("");
    setSchoolMeal("");
    setPickyEater(false);
    setTrimester(null);
    setHighRisk(null);
    setMonthsPP("");
    setFeedingMode("");
    setConsultedDoctor(false);
    setMealMode("shared");
    setError(null);
    setStep(0);
    setMemberIndex((i) => i + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const submit = () => {
    const input = assemble();
    if (!input.name || input.name.length < 2) return setError("اكتبي الاسم");
    if (!input.birth_year) return setError("اكتبي سنة الميلاد");
    // Bounds mirror the DB check constraints (numeric(5,2)) — guard here so an
    // out-of-range value gets a clear message instead of a raw "numeric field
    // overflow" from Postgres.
    const rangeError = physicalRangeError(input.height_cm, input.weight_kg);
    if (rangeError) return setError(rangeError);
    const yearError = birthYearError(input.birth_year);
    if (yearError) return setError(yearError);
    startTransition(async () => {
      const result = editMemberId
        ? await updateFamilyMember(editMemberId, input)
        : await addFamilyMember(input);
      if (!result.ok) {
        // Member is saved, but their tier can't cover the new headcount → upgrade.
        if ("upgrade_required" in result) {
          setUpgrade({ current: result.current, max: result.max });
          return;
        }
        setError(result.error);
        return;
      }
      // Adding several of this type: this one is saved, keep collecting the next
      // before doing any navigation. (count only applies to add, never edit.)
      if (memberIndex + 1 < count) {
        resetForNext();
        return;
      }
      // Driven by a parent sequence (onboarding family builder) → hand control back
      // instead of navigating, so it can move on to the next member type.
      if (onComplete) {
        onComplete();
        return;
      }
      // Onboarding loop: the member was saved (generation deferred to the end), so
      // return to the add-another-member pop-up rather than the plan.
      if (onboarding) {
        router.push("/onboarding/members");
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
  // More members of this type still to collect → the final action continues to
  // the next one rather than finishing.
  const moreToCome = memberIndex + 1 < count;
  const finalLabel = moreToCome ? "التالي" : (terminalLabel ?? "أنشئي الخطة");
  const nextLabel =
    isLastBeforeDoctor && !doctorNeeded ? finalLabel : "التالي";

  if (upgrade) {
    return (
      <main className="min-h-screen bg-brand-surface">
        <div className="container-app py-12 md:py-16 max-w-md">
          <div className="bg-white rounded-3xl border border-brand-ink/5 shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-brand-lavender/40 mb-4">
              <Sparkles className="size-7 text-brand-purple-900" aria-hidden="true" />
            </div>
            <h2 className="font-extrabold text-2xl text-brand-ink leading-tight">
              محتاجة باقة أكبر لإضافة أفراد
            </h2>
            <p className="mt-3 text-brand-ink-muted text-sm leading-relaxed">
              باقتك الحالية تكفي {upgrade.max}، وعائلتك صارت {upgrade.current}.
              حفظنا بيانات {name}، ورقّي باقتك عشان نجهّز خطط العائلة المنسقة.
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
        <Loader2 className="size-8 animate-spin motion-reduce:animate-none text-brand-purple-900" aria-hidden="true" />
        <p className="text-brand-ink font-bold text-lg">
          نحضّر خطة {name}…
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
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-bold text-base text-brand-ink truncate">
                {role === "dad" ? "إضافة الزوج" : TYPE_TITLES[type]}
              </h1>
              {count > 1 && (
                <span className="flex-shrink-0 rounded-full bg-brand-lavender/40 text-brand-purple-900 text-xs font-bold px-2.5 py-1 tabular-nums">
                  {TYPE_NOUNS[type]} {memberIndex + 1} من {count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <BackToDashboard />
              <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
                {step + 1} / {total}
              </span>
            </div>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نحسب العمر منها عشان نخصّص الخطة.
                  </p>
                </header>
                <TextField id="m-name" label="الاسم" value={name} onChange={setName} placeholder="مثلاً: خالد" />
                <NumberField id="m-by" label="سنة الميلاد" value={birthYear} onChange={setBirthYear} placeholder="1988" />
                <PrimaryButton
                  onClick={() => {
                    if (name.trim().length < 2 || !birthYear)
                      return setError("أكملي الاسم وسنة الميلاد");
                    const yearError = birthYearError(Number(birthYear));
                    if (yearError) return setError(yearError);
                    goNext();
                  }}
                >
                  التالي
                </PrimaryButton>
              </>
            )}

            {key === "sex" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الجنس</h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نختار الأنسب لحساب احتياجه الغذائي.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {type === "child"
                      ? "نستخدمها للسياق العام فقط، خطة الطفل بالحصص لا بالسعرات."
                      : "نستخدمها لحساب احتياجه الغذائي بدقة."}
                  </p>
                </header>
                <NumberField id="m-h" label="الطول (سم)" value={heightCm} onChange={setHeightCm} placeholder="120" />
                <NumberField id="m-w" label="الوزن (كجم)" value={weightKg} onChange={setWeightKg} placeholder="40" />
                <PrimaryButton
                  onClick={() => {
                    if (!heightCm || !weightKg) return setError("أكملي الطول والوزن");
                    const rangeError = physicalRangeError(Number(heightCm), Number(weightKg));
                    if (rangeError) return setError(rangeError);
                    goNext();
                  }}
                >
                  التالي
                </PrimaryButton>
              </>
            )}

            {key === "activity" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">مستوى النشاط</h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    كل ما زاد نشاطه، زادت سعراته.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    حركة الطفل خلال يومه.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نبني خطته حول هدفه.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نراعي وجباته خارج البيت.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نختار أطباق مألوفة ومحبّبة لو كان صعب.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    احتياجها يختلف حسب مرحلة الحمل.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    لو عالي الخطورة، نطلب استشارة الطبيب.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    احتياج الرضاعة يختلف حسب المرحلة.
                  </p>
                </header>
                <NumberField id="m-pp" label="عدد الأشهر" value={monthsPP} onChange={setMonthsPP} placeholder="3" />
                <PrimaryButton onClick={() => (monthsPP ? goNext() : setError("اكتبي عدد الأشهر"))}>التالي</PrimaryButton>
              </>
            )}

            {key === "feeding" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">طريقة الرضاعة</h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نراعي احتياج الحليب حسب نوع الرضاعة.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اختاري اللي ينطبق، أو تجاوزي.
                  </p>
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

            {key === "mealMode" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    نمط الوجبات
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    وجبات مشتركة مع العائلة، أو خطة مستقلة لهذا الفرد؟
                  </p>
                </header>
                <div className="grid gap-2">
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
                    خطة مستقلة لهذا الفرد
                  </OptionButton>
                </div>
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {key === "medical" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">الحالات الصحية</h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اختاري اللي ينطبق، أو تجاوزي.
                  </p>
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
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نتجنب اللي يسبب لك غثيان، أو تجاوزي.
                  </p>
                </header>
                <ChipInput value={allergies} onChange={setAllergies} disabled={isPending} placeholder="اكتبيها، أو تجاوزي" />
                <PrimaryButton onClick={advanceOrSubmit}>{nextLabel}</PrimaryButton>
              </>
            )}

            {key === "supplements" && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">تأخذين فيتامينات أو مكملات؟</h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    معلومة تساعدنا نكمل خطتها، أو تجاوزي.
                  </p>
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
                  {finalLabel}
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

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
              رجوع
            </button>
          ) : (
            <span />
          )}

          {/* Family is optional — let her bail out and generate the plan now. */}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isPending}
              className="px-3 py-2 -me-3 text-brand-ink-muted hover:text-brand-ink text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
            >
              تخطّي الآن — أضيفهم لاحقاً
            </button>
          )}
        </div>
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
