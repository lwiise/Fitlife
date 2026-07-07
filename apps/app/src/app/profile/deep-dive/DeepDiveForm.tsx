"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { saveDeepDive, type DeepDiveInput } from "./actions";

// Option lists (فصحى). Values are the Zod-enforced slugs stored in 00013.
const EXERCISE_DURATION = [
  { value: "lt30", label: "أقل من 30 دقيقة" },
  { value: "m30_60", label: "30 إلى 60 دقيقة" },
  { value: "gt60", label: "أكثر من 60 دقيقة" },
] as const;
const MEALS_PER_DAY = [2, 3, 4, 5] as const;
const YES_NO = [
  { value: "yes", label: "نعم" },
  { value: "no", label: "لا" },
] as const;
const BREAKFAST = [
  { value: "regular", label: "بانتظام" },
  { value: "sometimes", label: "أحياناً" },
  { value: "never", label: "لا أتناوله" },
] as const;
const SLEEP_QUALITY = [
  { value: "excellent", label: "ممتازة" },
  { value: "good", label: "جيدة" },
  { value: "fair", label: "متوسطة" },
  { value: "poor", label: "ضعيفة" },
] as const;
const STRESS = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "مرتفع" },
] as const;
const WHO_COOKS = [
  { value: "me", label: "أنا" },
  { value: "family_member", label: "أحد أفراد الأسرة" },
  { value: "cook", label: "طاهٍ أو خدامة" },
  { value: "delivery", label: "أطلب الطعام غالباً" },
] as const;
const COOKING_TIME = [
  { value: "lt20", label: "أقل من 20 دقيقة" },
  { value: "m20_40", label: "20 إلى 40 دقيقة" },
  { value: "gt40", label: "أكثر من 40 دقيقة" },
] as const;

export type DeepDiveInitial = DeepDiveInput;

function OptionButton({
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
      className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        active
          ? "border-brand-purple-900 bg-brand-purple-900/5"
          : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
      }`}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-lg text-brand-ink border-b border-brand-ink/5 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-brand-ink mb-2">{label}</p>
      {children}
    </div>
  );
}

/** Toggle-able single select: pressing the active option clears it (all optional). */
function useToggle<T extends string>(initial: T | null) {
  const [value, setValue] = useState<T | null>(initial);
  const toggle = (v: T) => setValue((cur) => (cur === v ? null : v));
  return [value, toggle] as const;
}

export function DeepDiveForm({ initial }: { initial: DeepDiveInitial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [waist, setWaist] = useState(initial.waist_cm != null ? String(initial.waist_cm) : "");
  const [steps, setSteps] = useState(
    initial.steps_daily != null ? String(initial.steps_daily) : "",
  );
  const [duration, toggleDuration] = useToggle(initial.exercise_duration);
  const [likedFoods, setLikedFoods] = useState<string[]>(initial.liked_foods);
  const [mealsPerDay, setMealsPerDay] = useState<number | null>(initial.meals_per_day);
  const [snacks, toggleSnacks] = useToggle(initial.snacks_habit);
  const [breakfast, toggleBreakfast] = useToggle(initial.breakfast_habit);
  const [fasting, toggleFasting] = useToggle(initial.intermittent_fasting);
  const [recall, setRecall] = useState(initial.food_recall_24h ?? "");
  const [sleepQuality, toggleSleepQuality] = useToggle(initial.sleep_quality);
  const [stress, toggleStress] = useToggle(initial.stress_level);
  const [whoCooks, toggleWhoCooks] = useToggle(initial.who_cooks);
  const [cookingTime, toggleCookingTime] = useToggle(initial.cooking_time);
  const [previousDiets, setPreviousDiets] = useState(initial.previous_diets ?? "");
  const [budget, setBudget] = useState(initial.food_budget ?? "");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveDeepDive({
        waist_cm: waist ? Number(waist) : null,
        steps_daily: steps ? Number(steps) : null,
        exercise_duration: duration,
        liked_foods: likedFoods,
        meals_per_day: mealsPerDay,
        snacks_habit: snacks,
        breakfast_habit: breakfast,
        intermittent_fasting: fasting,
        food_recall_24h: recall.trim() || null,
        sleep_quality: sleepQuality,
        stress_level: stress,
        who_cooks: whoCooks,
        cooking_time: cookingTime,
        previous_diets: previousDiets.trim() || null,
        food_budget: budget.trim() || null,
      });
      if (!result.ok) return setError(result.error);
      router.push("/profile?edited=deep-dive");
    });
  };

  const numberInput =
    "w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900";
  const textArea =
    "w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 resize-none";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          أسئلة إضافية لخطة أدق
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          كل الأسئلة اختيارية. كلما أجبتِ أكثر، صارت خطتك أدق وأقرب لنمط حياتك.
        </p>
      </header>

      <Group title="القياسات والحركة">
        <div className="grid grid-cols-2 gap-3">
          <Field label="محيط الخصر (سم، اختياري)">
            <input type="number" inputMode="decimal" dir="ltr" min={30} max={250} value={waist} onChange={(e) => setWaist(e.target.value)} className={numberInput} />
          </Field>
          <Field label="متوسط الخطوات اليومية">
            <input type="number" inputMode="numeric" dir="ltr" min={0} max={60000} value={steps} onChange={(e) => setSteps(e.target.value)} className={numberInput} />
          </Field>
        </div>
        <Field label="مدة التمرين المعتادة">
          <div className="grid grid-cols-3 gap-2">
            {EXERCISE_DURATION.map((o) => (
              <OptionButton key={o.value} active={duration === o.value} onClick={() => toggleDuration(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
      </Group>

      <Group title="عاداتك الغذائية">
        <Field label="أطعمة تحبينها">
          <ChipInput value={likedFoods} onChange={setLikedFoods} disabled={isPending} placeholder="مثلاً: سلمون، أفوكادو" />
        </Field>
        <Field label="كم وجبة تفضلين يومياً؟">
          <div className="grid grid-cols-4 gap-2">
            {MEALS_PER_DAY.map((n) => (
              <OptionButton key={n} active={mealsPerDay === n} onClick={() => setMealsPerDay((cur) => (cur === n ? null : n))}>
                {n === 5 ? "5 أو أكثر" : String(n)}
              </OptionButton>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="هل تتناولين وجبات خفيفة؟">
            <div className="grid grid-cols-2 gap-2">
              {YES_NO.map((o) => (
                <OptionButton key={o.value} active={snacks === o.value} onClick={() => toggleSnacks(o.value)}>{o.label}</OptionButton>
              ))}
            </div>
          </Field>
          <Field label="هل تطبقين الصيام المتقطع؟">
            <div className="grid grid-cols-2 gap-2">
              {YES_NO.map((o) => (
                <OptionButton key={o.value} active={fasting === o.value} onClick={() => toggleFasting(o.value)}>{o.label}</OptionButton>
              ))}
            </div>
          </Field>
        </div>
        <Field label="هل تتناولين الإفطار؟">
          <div className="grid grid-cols-3 gap-2">
            {BREAKFAST.map((o) => (
              <OptionButton key={o.value} active={breakfast === o.value} onClick={() => toggleBreakfast(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
        <Field label="ماذا تناولتِ خلال آخر 24 ساعة؟ (مع المشروبات إن أمكن)">
          <textarea value={recall} onChange={(e) => setRecall(e.target.value)} maxLength={1000} rows={3} className={textArea} placeholder="اكتبي يومك الغذائي هنا" />
        </Field>
      </Group>

      <Group title="النوم والتوتر">
        <Field label="كيف تصفين جودة نومك؟">
          <div className="grid grid-cols-4 gap-2">
            {SLEEP_QUALITY.map((o) => (
              <OptionButton key={o.value} active={sleepQuality === o.value} onClick={() => toggleSleepQuality(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
        <Field label="كيف تصفين مستوى التوتر لديكِ؟">
          <div className="grid grid-cols-3 gap-2">
            {STRESS.map((o) => (
              <OptionButton key={o.value} active={stress === o.value} onClick={() => toggleStress(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
      </Group>

      <Group title="الطبخ والميزانية">
        <Field label="من يعدّ الطعام غالباً؟">
          <div className="grid grid-cols-2 gap-2">
            {WHO_COOKS.map((o) => (
              <OptionButton key={o.value} active={whoCooks === o.value} onClick={() => toggleWhoCooks(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
        <Field label="كم دقيقة يمكن تخصيصها للطهي يومياً؟">
          <div className="grid grid-cols-3 gap-2">
            {COOKING_TIME.map((o) => (
              <OptionButton key={o.value} active={cookingTime === o.value} onClick={() => toggleCookingTime(o.value)}>{o.label}</OptionButton>
            ))}
          </div>
        </Field>
        <Field label="هل سبق أن اتبعتِ نظاماً غذائياً؟ ما الذي نجح وما الذي لم ينجح؟">
          <textarea value={previousDiets} onChange={(e) => setPreviousDiets(e.target.value)} maxLength={1000} rows={3} className={textArea} placeholder="اكتبي تجربتك باختصار" />
        </Field>
        <Field label="ميزانية الطعام (اختياري)">
          <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={200} className={numberInput.replace(" tabular-nums", "")} placeholder="مثلاً: نحو 2000 ريال شهرياً" />
        </Field>
      </Group>

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
