"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step3Schema } from "../schema";

type FormData = z.infer<typeof step3Schema>;

const GOAL_OPTIONS: Array<{ value: FormData["primary_goal"]; label: string }> = [
  { value: "lose_weight", label: "خسارة وزن" },
  { value: "maintain", label: "الحفاظ على وزني" },
  { value: "gain_weight", label: "زيادة وزن" },
  { value: "general_health", label: "صحة عامة" },
  { value: "pregnancy", label: "حامل" },
  { value: "post_pregnancy", label: "بعد الولادة" },
];

export function Step3Goal({
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
    resolver: zodResolver(step3Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          إيش هدفك؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          هذا يأثر على كل التوصيات بعدين.
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">هدفك الأساسي</legend>
        <Controller
          name="primary_goal"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((opt) => {
                const checked = field.value === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center justify-center text-center rounded-2xl border-2 px-4 py-4 cursor-pointer transition-colors min-h-[3.5rem] ${
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
                    <span className="font-bold text-brand-ink text-sm leading-tight">
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.primary_goal && (
          <p role="alert" className="mt-2 text-red-600 text-sm leading-relaxed">
            اختاري هدفك
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
