"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { saveFamilyWidePreferences } from "../actions";

const TOTAL_STEPS = 5;

const CUISINES: { value: string; label: string }[] = [
  { value: "khaleeji", label: "خليجي" },
  { value: "mediterranean", label: "متوسطي" },
  { value: "mixed", label: "مختلط" },
  { value: "international", label: "عالمي" },
];

const DIETARY: { value: string; label: string }[] = [
  { value: "vegetarian", label: "نباتي" },
  { value: "gluten_free", label: "خالي من الجلوتين" },
  { value: "lactose_free", label: "خالي من اللاكتوز" },
  { value: "nut_free", label: "خالي من المكسرات" },
  { value: "egg_free", label: "خالي من البيض" },
];

const COOKING: { value: string; label: string }[] = [
  { value: "grilling", label: "شوي" },
  { value: "baking", label: "خبيز" },
  { value: "steaming", label: "طبخ بالبخار" },
  { value: "frying_minimal", label: "طبخ بزيت قليل" },
  { value: "deep_frying", label: "قلي عميق (سنقلّله في الخطط)" },
];

const MEAL_OUT: { value: string; label: string }[] = [
  { value: "never", label: "أبداً" },
  { value: "rarely", label: "نادراً (1-2)" },
  { value: "sometimes", label: "أحياناً (3-4)" },
  { value: "often", label: "غالباً (5+)" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
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
      {isPending && (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function FamilyWideForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [cuisine, setCuisine] = useState("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [cooking, setCooking] = useState<string[]>([]);
  const [mealOut, setMealOut] = useState("");

  const goNext = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = () => {
    setError(null);
    if (!cuisine) {
      setStep(0);
      return setError("اختاري المطبخ المفضل");
    }
    if (!mealOut) return setError("اختاري كم مرة تأكلون خارج البيت");

    startTransition(async () => {
      // حلال دائماً ضمن القيود.
      const result = await saveFamilyWidePreferences({
        cuisine_preference: cuisine,
        family_dietary_restrictions: ["halal", ...dietary],
        family_dislikes: dislikes,
        cooking_methods: cooking,
        meal_out_frequency: mealOut,
      });
      if (!result.ok) return setError(result.error);
      router.push("/onboarding/mom");
    });
  };

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base text-brand-ink">عن عائلتك</h1>
            <span className="text-brand-ink-muted text-xs font-medium tabular-nums">
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
          <div
            className="h-1.5 bg-brand-surface rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          >
            <motion.div
              className="h-full bg-gradient-to-l from-brand-purple-900 via-brand-pink to-brand-yellow"
              initial={false}
              animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
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
            className="space-y-6"
          >
            {step === 0 && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    ما المطبخ المفضل لعائلتك؟
                  </h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  {CUISINES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCuisine(o.value)}
                      aria-pressed={cuisine === o.value}
                      className={`min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        cuisine === o.value
                          ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <PrimaryButton onClick={() => (cuisine ? goNext() : setError("اختاري المطبخ المفضل"))}>
                  التالي
                </PrimaryButton>
              </>
            )}

            {step === 1 && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    هل عندكم أي قيود غذائية في العائلة؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اختاري اللي ينطبق، أو تجاوزي.
                  </p>
                </header>
                <div className="flex flex-wrap gap-2">
                  {DIETARY.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setDietary((s) => toggle(s, o.value))}
                      aria-pressed={dietary.includes(o.value)}
                      className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        dietary.includes(o.value)
                          ? "border-brand-pink bg-brand-pink-light text-brand-pink"
                          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {step === 2 && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    أي أطعمة العائلة لا تأكلها أبداً؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اكتبيها، أو تجاوزي.
                  </p>
                </header>
                <ChipInput
                  value={dislikes}
                  onChange={setDislikes}
                  disabled={isPending}
                  placeholder="مثلاً: كبدة، روبيان"
                />
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {step === 3 && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    ما طرق الطبخ المفضلة عندكم؟
                  </h2>
                  <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
                    اختاري اللي ينطبق، أو تجاوزي.
                  </p>
                </header>
                <div className="flex flex-wrap gap-2">
                  {COOKING.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCooking((s) => toggle(s, o.value))}
                      aria-pressed={cooking.includes(o.value)}
                      className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        cooking.includes(o.value)
                          ? "border-brand-purple-900 bg-brand-lavender/40 text-brand-purple-900"
                          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <PrimaryButton onClick={goNext}>التالي</PrimaryButton>
              </>
            )}

            {step === 4 && (
              <>
                <header>
                  <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
                    كم مرة تأكلون خارج البيت في الأسبوع؟
                  </h2>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_OUT.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setMealOut(o.value)}
                      aria-pressed={mealOut === o.value}
                      className={`min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                        mealOut === o.value
                          ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                          : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-purple-900/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <PrimaryButton onClick={submit} isPending={isPending}>
                  التالي — ملفك الشخصي
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
