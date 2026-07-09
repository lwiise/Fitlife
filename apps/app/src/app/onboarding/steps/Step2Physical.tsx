"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step2Schema } from "../schema";
import { genderPick } from "@/lib/copy/gender";

type FormData = z.infer<typeof step2Schema>;

export function Step2Physical({
  defaultValues,
  onSubmit,
  isPending,
  sex,
}: {
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  sex?: "female" | "male";
}) {
  const g = genderPick(sex);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          قياساتك الأساسية
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          نحسب احتياجك اليومي من السعرات بدقة، ونتابع تغيّر القياسات مع الخطة.
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="waist_cm"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            محيط الخصر
          </label>
          <div className="relative" dir="ltr">
            <input
              id="waist_cm"
              type="number"
              inputMode="decimal"
              dir="ltr"
              placeholder="80"
              disabled={isPending}
              step="0.5"
              className="w-full px-4 py-3 pe-12 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
              {...register("waist_cm", { valueAsNumber: true })}
              aria-invalid={!!errors.waist_cm}
            />
            <span
              className="absolute inset-y-0 end-3 flex items-center text-brand-ink-muted text-sm pointer-events-none"
              aria-hidden="true"
            >
              سم
            </span>
          </div>
          {errors.waist_cm && (
            <p role="alert" className="mt-1.5 text-red-600 text-sm leading-relaxed">
              {errors.waist_cm.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="hip_cm"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            محيط الورك (اختياري)
          </label>
          <div className="relative" dir="ltr">
            <input
              id="hip_cm"
              type="number"
              inputMode="decimal"
              dir="ltr"
              placeholder="100"
              disabled={isPending}
              step="0.5"
              className="w-full px-4 py-3 pe-12 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
              {...register("hip_cm", { valueAsNumber: true })}
              aria-invalid={!!errors.hip_cm}
            />
            <span
              className="absolute inset-y-0 end-3 flex items-center text-brand-ink-muted text-sm pointer-events-none"
              aria-hidden="true"
            >
              سم
            </span>
          </div>
          {errors.hip_cm && (
            <p role="alert" className="mt-1.5 text-red-600 text-sm leading-relaxed">
              {errors.hip_cm.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="target_weight_kg"
          className="block text-sm font-bold text-brand-ink mb-2"
        >
          الوزن المستهدف (اختياري)
        </label>
        <div className="relative" dir="ltr">
          <input
            id="target_weight_kg"
            type="number"
            inputMode="decimal"
            dir="ltr"
            placeholder="60"
            disabled={isPending}
            step="0.1"
            className="w-full px-4 py-3 pe-12 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
            {...register("target_weight_kg", { valueAsNumber: true })}
            aria-invalid={!!errors.target_weight_kg}
          />
          <span
            className="absolute inset-y-0 end-3 flex items-center text-brand-ink-muted text-sm pointer-events-none"
            aria-hidden="true"
          >
            كجم
          </span>
        </div>
        <p className="mt-1.5 text-brand-ink-muted text-xs leading-relaxed">
          {g(
            "يساعدنا على ضبط وتيرة الخطة. اتركيه فارغاً إن كان هدفك الثبات أو الصحة العامة.",
            "يساعدنا على ضبط وتيرة الخطة. اتركه فارغاً إن كان هدفك الثبات أو الصحة العامة.",
          )}
        </p>
        {errors.target_weight_kg && (
          <p role="alert" className="mt-1.5 text-red-600 text-sm leading-relaxed">
            {errors.target_weight_kg.message}
          </p>
        )}
      </div>

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
