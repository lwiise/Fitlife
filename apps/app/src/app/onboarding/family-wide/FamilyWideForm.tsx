"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { saveFamilyWidePreferences } from "../actions";

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

export function FamilyWideForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [cuisine, setCuisine] = useState("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [cooking, setCooking] = useState<string[]>([]);
  const [mealOut, setMealOut] = useState("");

  const onSubmit = () => {
    setError(null);
    if (!cuisine) return setError("اختاري المطبخ المفضل");
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
    <div className="space-y-8">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          خلينا نعرف عائلتك
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          خمس أسئلة عن البيت كله، بعدها نبدأ بملفك الشخصي.
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-brand-ink mb-1">
          ما المطبخ المفضل لعائلتك؟
        </legend>
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
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-brand-ink mb-1">
          هل عندكم أي قيود غذائية في العائلة؟
        </legend>
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
      </fieldset>

      <div className="space-y-3">
        <label
          htmlFor="family-dislikes"
          className="block text-sm font-bold text-brand-ink"
        >
          أي أطعمة العائلة لا تأكلها أبداً؟
        </label>
        <ChipInput
          id="family-dislikes"
          value={dislikes}
          onChange={setDislikes}
          disabled={isPending}
          placeholder="مثلاً: كبدة، روبيان"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-brand-ink mb-1">
          ما طرق الطبخ المفضلة عندكم؟
        </legend>
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
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-brand-ink mb-1">
          كم مرة تأكلون خارج البيت في الأسبوع؟
        </legend>
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
      </fieldset>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 text-sm leading-relaxed">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending && (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        التالي — ملفك الشخصي
      </button>
    </div>
  );
}
