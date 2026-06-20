"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChipInput } from "@/components/ChipInput";
import { CUISINES, DIETARY, COOKING, MEAL_OUT } from "../labels";
import { saveMomFamilyPreferences, saveHousekeeperLanguage } from "../actions";
import {
  LOCALE_CODES_ORDERED,
  LOCALE_INFO,
  type LocaleCode,
} from "@/lib/plans/locales";

type CuisineValue = "khaleeji" | "mediterranean" | "mixed" | "international";
type MealOutValue = "never" | "rarely" | "sometimes" | "often";

export type FamilyPrefsInitial = {
  cuisine_preference: string;
  family_dietary_restrictions: string[];
  family_dislikes: string[];
  cooking_methods: string[];
  meal_out_frequency: string;
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

function Pill({
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
      className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
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

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FamilyPreferencesEditForm({
  initial,
  housekeeper = null,
}: {
  initial: FamilyPrefsInitial;
  housekeeper?: { id: string; locale: LocaleCode } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [cuisine, setCuisine] = useState(initial.cuisine_preference);
  const [dietary, setDietary] = useState<string[]>(initial.family_dietary_restrictions);
  const [dislikes, setDislikes] = useState<string[]>(initial.family_dislikes);
  const [cooking, setCooking] = useState<string[]>(initial.cooking_methods);
  const [mealOut, setMealOut] = useState(initial.meal_out_frequency);
  const [hkLang, setHkLang] = useState<LocaleCode>(housekeeper?.locale ?? "ar");

  const submit = () => {
    setError(null);
    if (!cuisine) return setError("اختاري المطبخ المفضل");
    if (!mealOut) return setError("اختاري كم مرة تأكلون خارج البيت");

    startTransition(async () => {
      const result = await saveMomFamilyPreferences({
        cuisine_preference: cuisine as CuisineValue,
        family_dietary_restrictions: dietary,
        family_dislikes: dislikes,
        cooking_methods: cooking,
        meal_out_frequency: mealOut as MealOutValue,
      });
      if (!result.ok) return setError(result.error);

      // Persist the housekeeper's reading language if it changed.
      if (housekeeper && hkLang !== housekeeper.locale) {
        const hkResult = await saveHousekeeperLanguage({
          housekeeper_id: housekeeper.id,
          preferred_language: hkLang,
        });
        if (!hkResult.ok) return setError(hkResult.error);
      }
      router.push("/profile?edited=family");
    });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          تفضيلات العائلة
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          تنطبق على وجبات العائلة كلها. الأكل حلال دائماً.
        </p>
      </header>

      <section className="space-y-3">
        <GroupHeading>المطبخ المفضل</GroupHeading>
        <div className="grid grid-cols-2 gap-2">
          {CUISINES.map((c) => (
            <OptionButton key={c.value} active={cuisine === c.value} onClick={() => setCuisine(c.value)}>
              {c.label}
            </OptionButton>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <GroupHeading>قيود غذائية للعائلة</GroupHeading>
        <div className="flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <Pill
              key={d.value}
              active={dietary.includes(d.value)}
              onClick={() => setDietary((s) => toggle(s, d.value))}
            >
              {d.label}
            </Pill>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <GroupHeading>أطعمة العائلة لا تأكلها أبداً</GroupHeading>
        <ChipInput
          value={dislikes}
          onChange={setDislikes}
          disabled={isPending}
          placeholder="مثلاً: كبدة، روبيان"
        />
      </section>

      <section className="space-y-3">
        <GroupHeading>طرق الطبخ</GroupHeading>
        <div className="flex flex-wrap gap-2">
          {COOKING.map((c) => (
            <Pill
              key={c.value}
              active={cooking.includes(c.value)}
              onClick={() => setCooking((s) => toggle(s, c.value))}
            >
              {c.label}
            </Pill>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <GroupHeading>كم مرة تأكلون خارج البيت؟</GroupHeading>
        <div className="grid grid-cols-2 gap-2">
          {MEAL_OUT.map((m) => (
            <OptionButton key={m.value} active={mealOut === m.value} onClick={() => setMealOut(m.value)}>
              {m.label}
            </OptionButton>
          ))}
        </div>
      </section>

      {housekeeper && (
        <section className="space-y-3">
          <GroupHeading>لغة الخدامة</GroupHeading>
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            باللغة اللي تقرأ بها الخدامة وصفات الطبخ.
          </p>
          <select
            value={hkLang}
            onChange={(e) => setHkLang(e.target.value as LocaleCode)}
            disabled={isPending}
            className="w-full min-h-11 px-4 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            {LOCALE_CODES_ORDERED.map((code) => {
              const info = LOCALE_INFO[code];
              return (
                <option key={code} value={code}>
                  {code === "ar" ? info.native_name : `${info.ar_name} (${info.native_name})`}
                </option>
              );
            })}
          </select>
          <p className="text-brand-ink-muted text-xs leading-relaxed">
            تغيير اللغة يترجم خطتك الحالية للغة الجديدة خلال لحظات.
          </p>
        </section>
      )}

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
