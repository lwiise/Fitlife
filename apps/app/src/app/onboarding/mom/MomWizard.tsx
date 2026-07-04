"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import {
  GATE_CONDITIONS,
  STABLE_CONDITIONS,
} from "@/lib/plans/medicalConditions";
import type { z } from "zod";
import type { UserGoal } from "@/lib/plans/goalMapping";
import type { step1Schema, step2Schema } from "../schema";
import { Step1Identity } from "../steps/Step1Identity";
import { Step2Physical } from "../steps/Step2Physical";
import { saveMomProfile, saveProfileStep } from "../actions";

const TOTAL_STEPS = 8;

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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [identity, setIdentity] = useState<Identity>();
  const [physical, setPhysical] = useState<Physical>();
  const [userGoal, setUserGoal] = useState<UserGoal | "">("");
  const [pregStatus, setPregStatus] = useState<"none" | "pregnant" | "lactating" | "">("");
  const [trimester, setTrimester] = useState<number | null>(null);
  const [highRisk, setHighRisk] = useState<boolean | null>(null);
  const [monthsPP, setMonthsPP] = useState<string>("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState("");
  const [consultedDoctor, setConsultedDoctor] = useState(false);

  const doctorNeeded = useMemo(
    () =>
      conditions.length > 0 ||
      otherCondition.trim().length > 0 ||
      (pregStatus === "pregnant" && highRisk === true),
    [conditions, otherCondition, pregStatus, highRisk],
  );

  const goNext = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const toggleCondition = (slug: string) =>
    setConditions((s) =>
      s.includes(slug) ? s.filter((c) => c !== slug) : [...s, slug],
    );

  const submit = () => {
    if (!identity || !physical || !userGoal || !pregStatus) {
      setError("في معلومات ناقصة، ارجعي وأكمليها");
      return;
    }
    startTransition(async () => {
      const result = await saveMomProfile({
        display_name: identity.display_name,
        birth_year: identity.birth_year,
        height_cm: physical.height_cm,
        weight_kg: physical.weight_kg,
        activity_level: physical.activity_level,
        user_goal: userGoal,
        pregnancy_status: pregStatus,
        trimester: trimester ?? undefined,
        high_risk_pregnancy: highRisk === true,
        months_postpartum: monthsPP ? Number(monthsPP) : undefined,
        allergies,
        dislikes,
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

  // Step 7 "next": go to doctor step only if needed, else submit.
  const afterMedical = () => {
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
              {step} / {TOTAL_STEPS}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {step === 1 && (
              <Step1Identity
                defaultValues={identity}
                isPending={isPending}
                onSubmit={(d) => {
                  setIdentity(d);
                  startTransition(async () => {
                    await saveProfileStep({
                      display_name: d.display_name,
                      birth_year: d.birth_year,
                    });
                    goNext();
                  });
                }}
              />
            )}

            {step === 2 && (
              <Step2Physical
                defaultValues={physical}
                isPending={isPending}
                onSubmit={(d) => {
                  setPhysical(d);
                  startTransition(async () => {
                    await saveProfileStep({
                      height_cm: d.height_cm,
                      weight_kg: d.weight_kg,
                      activity_level: d.activity_level,
                    });
                    goNext();
                  });
                }}
              />
            )}

            {step === 3 && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    وش هدفك الرئيسي؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نبني خطتك حول هدفك أنتِ.
                  </p>
                </header>
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
                <PrimaryButton onClick={() => (userGoal ? goNext() : setError("اختاري هدفك"))}>
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === 4 && (
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
                      <p className="text-sm font-bold text-brand-ink mb-2">
                        هل حملك يعتبر عالي الخطورة؟
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

                <PrimaryButton
                  onClick={() => {
                    if (!pregStatus) return setError("اختاري حالتك");
                    if (pregStatus === "pregnant" && (trimester == null || highRisk == null))
                      return setError("أكملي تفاصيل الحمل");
                    if (pregStatus === "lactating" && !monthsPP)
                      return setError("اكتبي كم شهر مرّ على الولادة");
                    goNext();
                  }}
                >
                  التالي
                </PrimaryButton>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    عندك حساسية من أكل معين؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    تكتبين أي حساسية باسمها، ونتجنبها تماماً.
                  </p>
                </header>
                <ChipInput
                  value={allergies}
                  onChange={setAllergies}
                  disabled={isPending}
                  placeholder="مثلاً: مكسرات، روبيان، لاكتوز"
                />
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    أكلات ما تحبينها شخصياً؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    نبعدها عن خطتك أنتِ.
                  </p>
                </header>
                <ChipInput
                  value={dislikes}
                  onChange={setDislikes}
                  disabled={isPending}
                  placeholder="مثلاً: كبدة، باذنجان"
                />
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    أي حالة صحية؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اختاري اللي ينطبق، أو تجاوزي إذا ما عندك.
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

                <PrimaryButton onClick={afterMedical} isPending={isPending && !doctorNeeded}>
                  {doctorNeeded ? "التالي" : "أنشئي خطتي"}
                </PrimaryButton>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-6">
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    استشارة الطبيب
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    لسلامتك، نتأكد إنك استشرتِ طبيبك قبل البدء بالخطة بسبب حالتك.
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
                    أكدت أنني استشرت طبيبي قبل البدء بالخطة
                  </span>
                </label>
                <PrimaryButton
                  onClick={() => (consultedDoctor ? submit() : setError("لازم تأكدي على استشارة الطبيب أولاً"))}
                  isPending={isPending}
                >
                  أنشئي خطتي
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

        {step > 1 && (
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
