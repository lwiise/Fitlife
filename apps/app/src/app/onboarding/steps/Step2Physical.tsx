"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step2Schema } from "../schema";

type FormData = z.infer<typeof step2Schema>;

const ACTIVITY_OPTIONS: Array<{
  value: FormData["activity_level"];
  label: string;
  sublabel: string;
}> = [
  { value: "sedentary", label: "قليلة الحركة", sublabel: "مكتبية، ما أتمرن" },
  { value: "light", label: "خفيفة", sublabel: "مشي خفيف 1-2 مرات في الأسبوع" },
  { value: "moderate", label: "متوسطة", sublabel: "تمارين 3-4 مرات في الأسبوع" },
  { value: "active", label: "نشطة", sublabel: "تمارين 5 مرات أو أكثر" },
  { value: "very_active", label: "نشطة جداً", sublabel: "رياضية محترفة" },
];

export function Step2Physical({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          كم طولك ووزنك؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          نحسب احتياجك اليومي من السعرات بدقة.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="height_cm"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            الطول
          </label>
          <div className="relative" dir="ltr">
            <input
              id="height_cm"
              type="number"
              inputMode="numeric"
              dir="ltr"
              placeholder="165"
              disabled={isPending}
              className="w-full px-4 py-3 pe-12 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
              {...register("height_cm", { valueAsNumber: true })}
              aria-invalid={!!errors.height_cm}
            />
            <span
              className="absolute inset-y-0 end-3 flex items-center text-brand-ink-muted text-sm pointer-events-none"
              aria-hidden="true"
            >
              سم
            </span>
          </div>
          {errors.height_cm && (
            <p role="alert" className="mt-1.5 text-red-600 text-sm leading-relaxed">
              {errors.height_cm.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="weight_kg"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            الوزن
          </label>
          <div className="relative" dir="ltr">
            <input
              id="weight_kg"
              type="number"
              inputMode="decimal"
              dir="ltr"
              placeholder="65"
              disabled={isPending}
              step="0.1"
              className="w-full px-4 py-3 pe-12 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
              {...register("weight_kg", { valueAsNumber: true })}
              aria-invalid={!!errors.weight_kg}
            />
            <span
              className="absolute inset-y-0 end-3 flex items-center text-brand-ink-muted text-sm pointer-events-none"
              aria-hidden="true"
            >
              كجم
            </span>
          </div>
          {errors.weight_kg && (
            <p role="alert" className="mt-1.5 text-red-600 text-sm leading-relaxed">
              {errors.weight_kg.message}
            </p>
          )}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm font-bold text-brand-ink mb-2">
          مستوى نشاطك
        </legend>
        <Controller
          name="activity_level"
          control={control}
          render={({ field }) => (
            <div className="space-y-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const checked = field.value === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`block rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors min-h-[3rem] ${
                      checked
                        ? "border-brand-purple-900 bg-brand-purple-900/5"
                        : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      checked={checked}
                      onChange={() => field.onChange(opt.value)}
                      className="sr-only"
                    />
                    <div className="font-bold text-brand-ink text-sm">{opt.label}</div>
                    <div className="text-brand-ink-muted text-xs mt-0.5">
                      {opt.sublabel}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.activity_level && (
          <p role="alert" className="text-red-600 text-sm leading-relaxed">
            اختاري مستوى نشاطك
          </p>
        )}
      </fieldset>

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
