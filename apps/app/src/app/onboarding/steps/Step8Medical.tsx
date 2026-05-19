"use client";

import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { z } from "zod";
import { step8Schema, medicalConditionOptions } from "../schema";

type FormData = z.infer<typeof step8Schema>;
type Condition = (typeof medicalConditionOptions)[number];

const CONDITION_LABELS: Record<Condition, string> = {
  diabetes_t1: "سكري نوع 1",
  diabetes_t2: "سكري نوع 2",
  hypertension: "ضغط دم مرتفع",
  hypothyroid: "خمول الغدة الدرقية",
  high_cholesterol: "كوليسترول مرتفع",
  kidney_disease: "أمراض كلى",
  heart_disease: "أمراض قلب",
};

function YesNo({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full bg-brand-surface p-1 border border-brand-ink/10">
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
          value
            ? "bg-brand-ink text-white"
            : "text-brand-ink-muted hover:text-brand-ink"
        }`}
      >
        نعم
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
          !value
            ? "bg-brand-ink text-white"
            : "text-brand-ink-muted hover:text-brand-ink"
        }`}
      >
        لا
      </button>
    </div>
  );
}

export function Step8Medical({
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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step8Schema),
    defaultValues:
      defaultValues ?? {
        has_medical_conditions: false,
        medical_conditions: [],
        is_pregnant: false,
        pregnancy_trimester: undefined,
        consulted_doctor: false,
      },
  });

  const hasMedical = useWatch({ control, name: "has_medical_conditions" });
  const isPregnant = useWatch({ control, name: "is_pregnant" });
  const showWarning = hasMedical || isPregnant;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          صحتك أهم شيء
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          هذي المعلومات سرية وتساعدنا نحضّر خطة آمنة.
        </p>
      </header>

      {/* Medical conditions block */}
      <div className="bg-white rounded-2xl border border-brand-ink/10 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-bold text-brand-ink text-base">عندك حالات طبية؟</p>
          <Controller
            name="has_medical_conditions"
            control={control}
            render={({ field }) => (
              <YesNo
                value={!!field.value}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>

        {hasMedical && (
          <Controller
            name="medical_conditions"
            control={control}
            render={({ field }) => {
              const value = (field.value ?? []) as Condition[];
              const toggle = (opt: Condition) => {
                if (value.includes(opt)) field.onChange(value.filter((v) => v !== opt));
                else field.onChange([...value, opt]);
              };
              return (
                <fieldset className="grid grid-cols-1 gap-2">
                  <legend className="sr-only">الحالات الطبية</legend>
                  {medicalConditionOptions.map((opt) => {
                    const checked = value.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors min-h-[2.75rem] ${
                          checked
                            ? "border-brand-purple-900 bg-brand-purple-900/5"
                            : "border-brand-ink/10 bg-brand-surface hover:border-brand-ink/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(opt)}
                          className="sr-only"
                        />
                        <span className="font-bold text-brand-ink text-sm">
                          {CONDITION_LABELS[opt]}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex items-center justify-center size-5 rounded-full border-2 transition-colors ${
                            checked
                              ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                              : "border-brand-ink/20 bg-white"
                          }`}
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                      </label>
                    );
                  })}
                  {errors.medical_conditions && (
                    <p role="alert" className="mt-1 text-red-600 text-xs">
                      {errors.medical_conditions.message}
                    </p>
                  )}
                </fieldset>
              );
            }}
          />
        )}
      </div>

      {/* Pregnancy block */}
      <div className="bg-white rounded-2xl border border-brand-ink/10 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-bold text-brand-ink text-base">حامل؟</p>
          <Controller
            name="is_pregnant"
            control={control}
            render={({ field }) => (
              <YesNo
                value={!!field.value}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>

        {isPregnant && (
          <Controller
            name="pregnancy_trimester"
            control={control}
            render={({ field }) => (
              <div>
                <p className="text-sm font-bold text-brand-ink mb-2">الثلث الحالي</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((t) => {
                    const checked = field.value === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        className={`min-h-[2.75rem] rounded-xl border-2 font-bold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                          checked
                            ? "border-brand-purple-900 bg-brand-purple-900/5 text-brand-ink"
                            : "border-brand-ink/10 bg-brand-surface text-brand-ink-muted hover:text-brand-ink"
                        }`}
                      >
                        الثلث {t}
                      </button>
                    );
                  })}
                </div>
                {errors.pregnancy_trimester && (
                  <p role="alert" className="mt-1 text-red-600 text-xs">
                    {errors.pregnancy_trimester.message}
                  </p>
                )}
              </div>
            )}
          />
        )}
      </div>

      {/* Safety guardrail */}
      {showWarning && (
        <div className="bg-brand-yellow/15 border-2 border-brand-yellow/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="size-5 text-brand-ink flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-brand-ink text-sm leading-tight">
                تحذير مهم
              </p>
              <p className="mt-1 text-brand-ink/80 text-sm leading-relaxed">
                خطتنا الغذائية مرجعية ومُولّدة بالذكاء الاصطناعي. للحالات الطبية
                الخاصة، استشيري طبيبك قبل اتباع أي خطة.
              </p>
            </div>
          </div>

          <Controller
            name="consulted_doctor"
            control={control}
            render={({ field }) => (
              <label className="flex items-start gap-3 cursor-pointer min-h-[2.75rem]">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="sr-only peer"
                  aria-invalid={!!errors.consulted_doctor}
                />
                <span
                  aria-hidden="true"
                  className={`flex items-center justify-center size-6 rounded-md border-2 flex-shrink-0 mt-0.5 transition-colors ${
                    field.value
                      ? "border-brand-purple-900 bg-brand-purple-900 text-white"
                      : "border-brand-ink/30 bg-white"
                  }`}
                >
                  {field.value && <Check className="size-4" />}
                </span>
                <span className="text-brand-ink text-sm leading-relaxed font-medium">
                  أكدت استشارتي للطبيب وأنا مسؤولة عن متابعة حالتي الصحية
                </span>
              </label>
            )}
          />
          {errors.consulted_doctor && (
            <p role="alert" className="text-red-600 text-xs">
              {errors.consulted_doctor.message}
            </p>
          )}
        </div>
      )}

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
        إنشاء خطتي
      </button>
    </form>
  );
}
