"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
} from "@/lib/plans/medicalConditions";
import type { z } from "zod";
import type { UserGoal } from "@/lib/plans/goalMapping";
import {
  ACTIVITY_LEVEL_LABELS,
  type ActivityLevel,
} from "@/lib/plans/activityLevel";
import {
  SLEEP_BAND_OPTIONS,
  STRESS_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  PERSONAL_RESTRICTION_OPTIONS,
  FEEDING_MODE_OPTIONS,
  PREGNANCY_MONTHS,
  trimesterFromMonth,
  type SleepBand,
  type StressLevel,
  type FeedingMode,
} from "@/lib/plans/intakeOptions";
import type { step1Schema, step2Schema } from "../schema";
import { Step1Identity } from "../steps/Step1Identity";
import { Step2Physical } from "../steps/Step2Physical";
import { saveMomProfile, saveProfileStep } from "../actions";
import { genderPick } from "@/lib/copy/gender";
import { CUISINES, COOKING } from "@/app/profile/labels";
import { WATER_LITERS_OPTIONS, type WaterLiters } from "@/lib/plans/waterOptions";

type Identity = z.infer<typeof step1Schema>;
type Physical = z.infer<typeof step2Schema>;

const GOALS: { value: UserGoal; label: string }[] = [
  { value: "lose_weight", label: "خسارة الدهون" },
  { value: "build_muscle", label: "بناء كتلة عضلية" },
  { value: "recomposition", label: "إعادة تشكيل الجسم (عضل أكثر ودهون أقل)" },
  { value: "maintain_weight", label: "المحافظة على الوزن" },
  { value: "athletic", label: "تحسين الأداء الرياضي" },
  { value: "improve_health", label: "تحسين الحالة الصحية" },
];

// Step keys (07/2026 consolidation): the employer questionnaire's 14 screens
// are folded into 10 without dropping a question — goal+activity share the
// calorie-equation screen, health conditions sit with meds/supplements, taste
// (likes/dislikes) with the kitchen, habits with the 24h recall, and the
// never-eat question lives with allergies (it's a hard exclusion). The doctor
// step is appended only when a medical signal requires it, and male owners
// skip the pregnancy step — the wizard length adapts.
const BASE_STEPS = [
  "identity",
  "physical",
  "goalActivity",
  "healthMeds",
  "pregnancy",
  "restrictions",
  "tasteKitchen",
  "habitsRecall",
  "lifestyle",
  "dietHistory",
] as const;
type StepKey = (typeof BASE_STEPS)[number] | "doctor";

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

function PrimaryButton({
  onClick,
  disabled,
  isPending,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPending}
      className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      {isPending && (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function MomWizard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const [identity, setIdentity] = useState<Identity>();
  const [physical, setPhysical] = useState<Physical>();
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [userGoal, setUserGoal] = useState<UserGoal | "">("");
  const [pregStatus, setPregStatus] = useState<"none" | "pregnant" | "lactating" | "">("");
  const [pregMonth, setPregMonth] = useState<number | null>(null);
  const [highRisk, setHighRisk] = useState<boolean | null>(null);
  const [feedingMode, setFeedingMode] = useState<FeedingMode | null>(null);
  const [monthsPP, setMonthsPP] = useState<string>("");
  const [nauseaFoods, setNauseaFoods] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [likedFoods, setLikedFoods] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [neverEat, setNeverEat] = useState<string[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState<number | null>(null);
  const [fasting, setFasting] = useState<"yes" | "no" | null>(null);
  const [foodRecall, setFoodRecall] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [supplements, setSupplements] = useState<string[]>([]);
  const [waterLiters, setWaterLiters] = useState<WaterLiters | null>(null);
  const [sleepBand, setSleepBand] = useState<SleepBand | null>(null);
  const [stress, setStress] = useState<StressLevel | null>(null);
  const [cuisinePref, setCuisinePref] = useState("");
  const [cookingMethods, setCookingMethods] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [dietTried, setDietTried] = useState<boolean | null>(null);
  const [dietSystem, setDietSystem] = useState("");
  const [dietWorked, setDietWorked] = useState("");
  const [dietFailed, setDietFailed] = useState("");
  const [consultedDoctor, setConsultedDoctor] = useState(false);

  // Feminine is the default voice; masculine forms swap in once a male owner
  // answers the الجنس question on the identity step.
  const isMale = identity?.sex === "male";
  const g = genderPick(identity?.sex);

  // The pregnancy clause is ignored for male owners — stale answers can
  // linger if the user answered the pregnancy step then flipped sex back
  // on the identity screen.
  const doctorNeeded = useMemo(
    () =>
      conditions.length > 0 ||
      otherCondition.trim().length > 0 ||
      (!isMale && pregStatus === "pregnant" && highRisk === true),
    [conditions, otherCondition, pregStatus, highRisk, isMale],
  );

  // Male owners skip the pregnancy/lactation step entirely.
  const stepKeys: StepKey[] = useMemo(() => {
    const base = BASE_STEPS.filter((s) => s !== "pregnancy" || !isMale);
    return doctorNeeded ? [...base, "doctor"] : base;
  }, [doctorNeeded, isMale]);
  const step = stepKeys[stepIndex] ?? "identity";
  const totalSteps = stepKeys.length;

  const goNext = () => {
    setError(null);
    setStepIndex((s) => Math.min(s + 1, totalSteps - 1));
  };
  const goBack = () => {
    setError(null);
    setStepIndex((s) => Math.max(s - 1, 0));
  };

  const toggleCondition = (slug: string) =>
    setConditions((s) =>
      s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug],
    );

  const submit = () => {
    if (
      !identity ||
      !physical ||
      !userGoal ||
      (!isMale && !pregStatus) ||
      !activityLevel ||
      !cuisinePref
    ) {
      setError(g("بعض المعلومات ناقصة، ارجعي وأكمليها", "بعض المعلومات ناقصة، ارجع وأكملها"));
      return;
    }
    // The three diet-history answers persist as one labeled text — the engine
    // already threads previous_diets into the skeleton lifestyle block.
    const previousDiets =
      dietTried === true
        ? [
            dietSystem.trim() && `النظام: ${dietSystem.trim()}`,
            dietWorked.trim() && `ما نجح: ${dietWorked.trim()}`,
            dietFailed.trim() && `ما لم ينجح: ${dietFailed.trim()}`,
          ]
            .filter(Boolean)
            .join("؛ ") || "اتبع نظاماً غذائياً سابقاً"
        : null;
    startTransition(async () => {
      const result = await saveMomProfile({
        sex: identity.sex,
        display_name: identity.display_name,
        birth_year: identity.birth_year,
        phone: identity.phone ?? null,
        height_cm: physical.height_cm,
        weight_kg: physical.weight_kg,
        waist_cm: physical.waist_cm,
        hip_cm: physical.hip_cm ?? null,
        target_weight_kg: physical.target_weight_kg ?? null,
        activity_level: activityLevel,
        water_liters: waterLiters,
        sleep_band: sleepBand,
        stress_level: stress,
        medications,
        supplements,
        nausea_foods: nauseaFoods,
        notes: notes.trim() || null,
        user_goal: userGoal,
        pregnancy_status: isMale || !pregStatus ? "none" : pregStatus,
        pregnancy_month: pregMonth ?? undefined,
        trimester: pregMonth != null ? trimesterFromMonth(pregMonth) : undefined,
        high_risk_pregnancy: highRisk === true,
        feeding_mode: feedingMode ?? undefined,
        months_postpartum: monthsPP ? Number(monthsPP) : undefined,
        dietary_restrictions: restrictions,
        allergies,
        liked_foods: likedFoods,
        dislikes,
        never_eat_foods: neverEat,
        meals_per_day: mealsPerDay,
        intermittent_fasting: fasting,
        food_recall_24h: foodRecall.trim() || null,
        previous_diets: previousDiets,
        cuisine_preference: cuisinePref,
        cooking_methods: cookingMethods,
        conditions,
        other_condition: otherCondition.trim() || undefined,
        consulted_doctor: consultedDoctor,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/onboarding/members");
    });
  };

  // Last content step: go to the doctor step only if needed, else submit.
  const afterLastStep = () => {
    if (doctorNeeded) goNext();
    else submit();
  };

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base text-brand-ink">ملفك الشخصي</h1>
            <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduceMotion ? 0 : -30 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
          >
            {step === "identity" && (
              <Step1Identity
                defaultValues={identity}
                isPending={isPending}
                onSubmit={(d) => {
                  setIdentity(d);
                  startTransition(async () => {
                    await saveProfileStep({
                      sex: d.sex,
                      display_name: d.display_name,
                      birth_year: d.birth_year,
                      phone: d.phone ?? null,
                    });
                    goNext();
                  });
                }}
              />
            )}

            {step === "physical" && (
              <Step2Physical
                defaultValues={physical}
                isPending={isPending}
                sex={identity?.sex}
                onSubmit={(d) => {
                  setPhysical(d);
                  startTransition(async () => {
                    await saveProfileStep({
                      height_cm: d.height_cm,
                      weight_kg: d.weight_kg,
                      waist_cm: d.waist_cm,
                      hip_cm: d.hip_cm ?? null,
                      target_weight_kg: d.target_weight_kg ?? null,
                    });
                    goNext();
                  });
                }}
              />
            )}

            {step === "goalActivity" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    هدفك ومستوى نشاطك
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {g(
                      "نبني خطتك حول هدفك أنتِ، وعلى نشاطك نبني معادلة السعرات.",
                      "نبني خطتك حول هدفك أنتَ، وعلى نشاطك نبني معادلة السعرات.",
                    )}
                  </p>
                </header>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    ما هدفك الرئيسي؟
                  </p>
                  <div className="space-y-2">
                    {GOALS.map((o) => (
                      <OptionButton
                        key={o.value}
                        full
                        active={userGoal === o.value}
                        onClick={() => {
                          setError(null);
                          setUserGoal(o.value);
                        }}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    ما مستوى نشاطك؟
                  </p>
                  <div className="space-y-2">
                    {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((level) => (
                      <OptionButton
                        key={level}
                        full
                        active={activityLevel === level}
                        onClick={() => {
                          setError(null);
                          setActivityLevel(level);
                        }}
                      >
                        {ACTIVITY_LEVEL_LABELS[level]}
                      </OptionButton>
                    ))}
                  </div>
                </div>

                <PrimaryButton
                  onClick={() => {
                    if (!userGoal) return setError(g("اختاري هدفك", "اختر هدفك"));
                    if (!activityLevel)
                      return setError(g("حدّدي مستوى نشاطك", "حدّد مستوى نشاطك"));
                    // The goal itself persists at final submit — its Sara
                    // mapping needs the health answers from later steps.
                    startTransition(async () => {
                      await saveProfileStep({ activity_level: activityLevel });
                      goNext();
                    });
                  }}
                  isPending={isPending}
                >
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === "pregnancy" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    حالة الحمل والرضاعة
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نراعي احتياجك الغذائي حسب حالتك.
                  </p>
                </header>
                <div className="space-y-2">
                  <OptionButton full active={pregStatus === "none"} onClick={() => setPregStatus("none")}>
                    لست حاملاً ولا مرضعة
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
                      <p className="text-sm font-bold text-brand-ink mb-2">شهر الحمل</p>
                      <div className="grid grid-cols-3 gap-2">
                        {PREGNANCY_MONTHS.map((mo) => (
                          <OptionButton
                            key={mo}
                            active={pregMonth === mo}
                            onClick={() => setPregMonth(mo)}
                          >
                            {String(mo)}
                          </OptionButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-ink mb-2">
                        هل حملك عالي الخطورة؟
                      </p>
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
                        أطعمة تسبب لكِ الغثيان حالياً (اختياري)
                      </p>
                      <ChipInput
                        value={nauseaFoods}
                        onChange={setNauseaFoods}
                        disabled={isPending}
                        ariaLabel="أطعمة تسبب الغثيان حالياً"
                        placeholder="مثلاً: بيض، دجاج"
                      />
                      <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                        نتجنبها مؤقتاً في خطتك حتى يزول الغثيان.
                      </p>
                    </div>
                  </div>
                )}

                {pregStatus === "lactating" && (
                  <div className="space-y-4 rounded-xl bg-white border border-brand-ink/5 p-4">
                    <div>
                      <p className="text-sm font-bold text-brand-ink mb-2">نوع الرضاعة</p>
                      <div className="grid grid-cols-2 gap-2">
                        {FEEDING_MODE_OPTIONS.map((o) => (
                          <OptionButton
                            key={o.value}
                            active={feedingMode === o.value}
                            onClick={() => setFeedingMode(o.value)}
                          >
                            {o.label}
                          </OptionButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="months-pp" className="block text-sm font-bold text-brand-ink mb-2">
                        عمر الطفل بالأشهر
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
                  </div>
                )}

                <PrimaryButton
                  onClick={() => {
                    if (!pregStatus) return setError("اختاري حالتك");
                    if (pregStatus === "pregnant" && (pregMonth == null || highRisk == null))
                      return setError("أكملي تفاصيل الحمل");
                    if (pregStatus === "lactating") {
                      const mpp = Number(monthsPP);
                      if (!feedingMode || !monthsPP || Number.isNaN(mpp) || mpp < 0 || mpp > 24)
                        return setError("أكملي تفاصيل الرضاعة — عمر الطفل بين 0 و24 شهراً");
                    }
                    goNext();
                  }}
                >
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === "restrictions" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    الحساسية والقيود الغذائية
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {g(
                      "اختاري ما ينطبق عليكِ، أو تجاوزي إن لم يوجد.",
                      "اختر ما ينطبق عليك، أو تجاوز إن لم يوجد.",
                    )}
                  </p>
                </header>

                <div className="flex flex-wrap gap-2">
                  {PERSONAL_RESTRICTION_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() =>
                        setRestrictions((s) =>
                          s.includes(r.value)
                            ? s.filter((v) => v !== r.value)
                            : [...s, r.value],
                        )
                      }
                      aria-pressed={restrictions.includes(r.value)}
                      className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        restrictions.includes(r.value)
                          ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g(
                      "حساسية من طعام معين؟ اكتبي كل حساسية باسمها (اختياري)",
                      "حساسية من طعام معين؟ اكتب كل حساسية باسمها (اختياري)",
                    )}
                  </p>
                  <ChipInput
                    value={allergies}
                    onChange={setAllergies}
                    disabled={isPending}
                    ariaLabel="الحساسية الغذائية"
                    placeholder="مثلاً: مكسرات، روبيان، لاكتوز"
                  />
                  <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                    نتجنبها تماماً في كل الوجبات.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g(
                      "أطعمة لا تتناولينها نهائياً (اختياري)",
                      "أطعمة لا تتناولها نهائياً (اختياري)",
                    )}
                  </p>
                  <ChipInput
                    value={neverEat}
                    onChange={setNeverEat}
                    disabled={isPending}
                    ariaLabel="أطعمة مستبعدة نهائياً"
                    placeholder="مثلاً: لحم غنم، محار"
                  />
                  <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                    تُستبعد من الخطة استبعاداً كاملاً، مثل الحساسية.
                  </p>
                </div>

                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </div>
            )}

            {step === "tasteKitchen" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    ذوقك ومطبخك
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نبني الوصفات على ذوقك وبالطرق المتاحة لديك.
                  </p>
                </header>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("أطعمة تحبينها (اختياري)", "أطعمة تحبها (اختياري)")}
                  </p>
                  <ChipInput
                    value={likedFoods}
                    onChange={setLikedFoods}
                    disabled={isPending}
                    ariaLabel="أطعمة مفضلة"
                    placeholder="مثلاً: سلمون، شوفان"
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("أطعمة لا تحبينها (اختياري)", "أطعمة لا تحبها (اختياري)")}
                  </p>
                  <ChipInput
                    value={dislikes}
                    onChange={setDislikes}
                    disabled={isPending}
                    ariaLabel="أطعمة غير محببة"
                    placeholder="مثلاً: كبدة، باذنجان"
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">المطبخ المفضل</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CUISINES.map((o) => (
                      <OptionButton
                        key={o.value}
                        active={cuisinePref === o.value}
                        onClick={() => {
                          setError(null);
                          setCuisinePref(o.value);
                        }}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    طرق الطبخ المفضلة (يمكن اختيار أكثر من خيار)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COOKING.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() =>
                          setCookingMethods((s) =>
                            s.includes(o.value)
                              ? s.filter((v) => v !== o.value)
                              : [...s, o.value],
                          )
                        }
                        aria-pressed={cookingMethods.includes(o.value)}
                        className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                          cookingMethods.includes(o.value)
                            ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                            : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <PrimaryButton
                  onClick={() =>
                    cuisinePref
                      ? goNext()
                      : setError(g("اختاري المطبخ المفضل", "اختر المطبخ المفضل"))
                  }
                >
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === "healthMeds" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    صحتك وأدويتك
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {g(
                      "اختاري ما ينطبق عليكِ وننسّق الخطة معه، أو تجاوزي إن لم يوجد.",
                      "اختر ما ينطبق عليك وننسّق الخطة معه، أو تجاوز إن لم يوجد.",
                    )}
                  </p>
                </header>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("هل لديكِ حالة صحية؟", "هل لديك حالة صحية؟")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...GATE_CONDITIONS, ...STABLE_CONDITIONS].map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCondition(c.slug)}
                        aria-pressed={conditions.includes(c.slug)}
                        className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                          conditions.includes(c.slug)
                            ? "border-brand-purple-900 bg-brand-purple-900/10 text-brand-purple-900"
                            : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                        }`}
                      >
                        {c.label_ar}
                      </button>
                    ))}
                  </div>
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
                    maxLength={200}
                    spellCheck={false}
                    className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                    placeholder={g("اكتبيها هنا", "اكتبها هنا")}
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("أدوية تستخدمينها بانتظام (اختياري)", "أدوية تستخدمها بانتظام (اختياري)")}
                  </p>
                  <ChipInput
                    value={medications}
                    onChange={setMedications}
                    disabled={isPending}
                    ariaLabel="أدوية مستخدمة بانتظام"
                    placeholder="مثلاً: ميتفورمين"
                  />
                  <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                    ننسّق توقيت الوجبات معها.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    مكملات غذائية (اختياري)
                  </p>
                  <ChipInput
                    value={supplements}
                    onChange={setSupplements}
                    disabled={isPending}
                    ariaLabel="مكملات غذائية"
                    placeholder="مثلاً: حديد، فيتامين د"
                  />
                </div>

                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </div>
            )}

            {step === "habitsRecall" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    عاداتك ويومك الغذائي
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نوزّع الوجبات على إيقاع يومك الفعلي.
                  </p>
                </header>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("كم وجبة تتناولين يومياً؟", "كم وجبة تتناول يومياً؟")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MEALS_PER_DAY_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        active={mealsPerDay === o.value}
                        onClick={() => {
                          setError(null);
                          setMealsPerDay(o.value);
                        }}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("هل تطبّقين الصيام المتقطع؟", "هل تطبّق الصيام المتقطع؟")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <OptionButton
                      active={fasting === "no"}
                      onClick={() => {
                        setError(null);
                        setFasting("no");
                      }}
                    >
                      لا
                    </OptionButton>
                    <OptionButton
                      active={fasting === "yes"}
                      onClick={() => {
                        setError(null);
                        setFasting("yes");
                      }}
                    >
                      نعم
                    </OptionButton>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g(
                      "اكتبي كل ما تناولتِه خلال آخر 24 ساعة مع المشروبات (اختياري)",
                      "اكتب كل ما تناولته خلال آخر 24 ساعة مع المشروبات (اختياري)",
                    )}
                  </p>
                  <textarea
                    value={foodRecall}
                    onChange={(e) => setFoodRecall(e.target.value)}
                    maxLength={1000}
                    rows={5}
                    aria-label={g(
                      "ما تناولتِه خلال آخر 24 ساعة",
                      "ما تناولته خلال آخر 24 ساعة",
                    )}
                    className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
                    placeholder="مثلاً: فطور — قهوة بحليب وتمرتان…"
                  />
                  <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
                    يساعدنا نفهم يومك.
                  </p>
                </div>

                <PrimaryButton
                  onClick={() => {
                    if (!mealsPerDay)
                      return setError(g("حدّدي عدد الوجبات", "حدّد عدد الوجبات"));
                    if (!fasting)
                      return setError(
                        g("أجيبي عن سؤال الصيام المتقطع", "أجب عن سؤال الصيام المتقطع"),
                      );
                    goNext();
                  }}
                >
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === "lifestyle" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    نمط يومك
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    تفاصيل صغيرة تجعل الخطة أدق. كلها اختيارية.
                  </p>
                </header>
                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("كم لتر ماء تشربين يومياً؟", "كم لتر ماء تشرب يومياً؟")}
                  </p>
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
                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("كم ساعة تنامين يومياً؟", "كم ساعة تنام يومياً؟")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SLEEP_BAND_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        active={sleepBand === o.value}
                        onClick={() =>
                          setSleepBand((cur) => (cur === o.value ? null : o.value))
                        }
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("كيف تصفين مستوى التوتر لديك؟", "كيف تصف مستوى التوتر لديك؟")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {STRESS_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        active={stress === o.value}
                        onClick={() =>
                          setStress((cur) => (cur === o.value ? null : o.value))
                        }
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="mom-notes" className="block text-sm font-bold text-brand-ink mb-2">
                    {g(
                      "هل من شيء آخر تودّين إخبارنا به؟ (اختياري)",
                      "هل من شيء آخر تودّ إخبارنا به؟ (اختياري)",
                    )}
                  </label>
                  <textarea
                    id="mom-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none"
                    placeholder="مثلاً: أفضّل وجبات سريعة التحضير أيام الدوام"
                  />
                </div>
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </div>
            )}

            {step === "dietHistory" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    الحميات السابقة
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {g(
                      "تجربتك السابقة تخبرنا ما يناسبك وما لا يناسبك.",
                      "تجربتك السابقة تخبرنا ما يناسبك وما لا يناسبك.",
                    )}
                  </p>
                </header>

                <div>
                  <p className="text-sm font-bold text-brand-ink mb-2">
                    {g("هل سبق أن اتبعتِ نظاماً غذائياً؟", "هل سبق أن اتبعت نظاماً غذائياً؟")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <OptionButton active={dietTried === false} onClick={() => setDietTried(false)}>
                      لا
                    </OptionButton>
                    <OptionButton active={dietTried === true} onClick={() => setDietTried(true)}>
                      نعم
                    </OptionButton>
                  </div>
                </div>

                {dietTried === true && (
                  <div className="space-y-4 rounded-xl bg-white border border-brand-ink/5 p-4">
                    <div>
                      <label htmlFor="diet-system" className="block text-sm font-bold text-brand-ink mb-2">
                        {g("ما النظام الذي اتبعتِه؟", "ما النظام الذي اتبعته؟")}
                      </label>
                      <input
                        id="diet-system"
                        type="text"
                        value={dietSystem}
                        onChange={(e) => setDietSystem(e.target.value)}
                        maxLength={200}
                        placeholder="مثلاً: كيتو، صيام متقطع"
                        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="diet-worked" className="block text-sm font-bold text-brand-ink mb-2">
                        ما الذي نجح معك؟ (اختياري)
                      </label>
                      <input
                        id="diet-worked"
                        type="text"
                        value={dietWorked}
                        onChange={(e) => setDietWorked(e.target.value)}
                        maxLength={200}
                        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="diet-failed" className="block text-sm font-bold text-brand-ink mb-2">
                        وما الذي لم ينجح؟ (اختياري)
                      </label>
                      <input
                        id="diet-failed"
                        type="text"
                        value={dietFailed}
                        onChange={(e) => setDietFailed(e.target.value)}
                        maxLength={200}
                        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                      />
                    </div>
                  </div>
                )}

                <PrimaryButton onClick={afterLastStep} isPending={isPending && !doctorNeeded}>
                  {doctorNeeded ? "التالي" : g("أنشئي خطتي", "أنشئ خطتي")}
                </PrimaryButton>
              </div>
            )}

            {step === "doctor" && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    استشارة الطبيب
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    {g(
                      "لسلامتك، نتأكد من أنكِ استشرتِ طبيبك قبل البدء بالخطة بسبب حالتك.",
                      "لسلامتك، نتأكد من أنك استشرت طبيبك قبل البدء بالخطة بسبب حالتك.",
                    )}
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
                    أؤكد أنني استشرت طبيبي قبل البدء بالخطة
                  </span>
                </label>
                <PrimaryButton
                  onClick={() => (consultedDoctor ? submit() : setError("يلزم تأكيد استشارة الطبيب أولاً"))}
                  isPending={isPending}
                >
                  {g("أنشئي خطتي", "أنشئ خطتي")}
                </PrimaryButton>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isPending}
            className="mt-6 inline-flex items-center gap-1 min-h-11 px-3 py-2 -ms-3 text-brand-ink-muted hover:text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            رجوع
          </button>
        )}
      </div>
    </main>
  );
}
