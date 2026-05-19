"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import type { z } from "zod";
import { step6Schema, dietaryRestrictionOptions } from "../schema";

type FormData = z.infer<typeof step6Schema>;
type Option = (typeof dietaryRestrictionOptions)[number];

const LABELS: Record<Option, string> = {
  gluten_free: "ما يأكلون قمح",
  lactose_intolerant: "ما يتحملون الحليب",
  vegetarian: "نباتي",
  vegan: "فيغان",
  nut_allergy: "حساسية مكسرات",
  shellfish_allergy: "حساسية مأكولات بحرية",
  egg_allergy: "حساسية بيض",
};

export function Step6Dietary({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
}) {
  const {
    handleSubmit,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(step6Schema),
    defaultValues: defaultValues ?? { family_dietary_restrictions: [] },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          في حساسيات أو قيود غذائية؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          تقدري تختاري أكثر من واحدة، أو ولا وحدة.
        </p>
      </header>

      <Controller
        name="family_dietary_restrictions"
        control={control}
        render={({ field }) => {
          const value = (field.value ?? []) as Option[];
          const toggle = (opt: Option) => {
            if (value.includes(opt)) field.onChange(value.filter((v) => v !== opt));
            else field.onChange([...value, opt]);
          };
          return (
            <fieldset className="space-y-2">
              <legend className="sr-only">قيود غذائية</legend>
              {dietaryRestrictionOptions.map((opt) => {
                const checked = value.includes(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors min-h-[3rem] ${
                      checked
                        ? "border-brand-purple-900 bg-brand-purple-900/5"
                        : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt)}
                      className="sr-only"
                    />
                    <span className="font-bold text-brand-ink text-sm">
                      {LABELS[opt]}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex items-center justify-center size-6 rounded-full border-2 transition-colors ${
                        checked
                          ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                          : "border-brand-ink/20 bg-white"
                      }`}
                    >
                      {checked && <Check className="size-4" />}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        }}
      />

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        {isPending && (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        التالي
      </button>
    </form>
  );
}
