"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step1Schema } from "../schema";

type FormData = z.infer<typeof step1Schema>;

export function Step1Identity({
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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          أهلاً، كيف اسمك؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          نسوي حسابك الشخصي عشان نحضّر لكِ خطة على مقاسك.
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="display_name"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            اسمك
          </label>
          <input
            id="display_name"
            type="text"
            autoComplete="given-name"
            placeholder="مثلاً: هند"
            spellCheck={false}
            disabled={isPending}
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
            {...register("display_name")}
            aria-invalid={!!errors.display_name}
            aria-describedby={errors.display_name ? "display_name-error" : undefined}
          />
          {errors.display_name && (
            <p
              id="display_name-error"
              role="alert"
              className="mt-1.5 text-red-600 text-sm leading-relaxed"
            >
              {errors.display_name.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="birth_year"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            سنة الميلاد
          </label>
          <input
            id="birth_year"
            type="number"
            inputMode="numeric"
            dir="ltr"
            placeholder="1990"
            disabled={isPending}
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors"
            {...register("birth_year", { valueAsNumber: true })}
            aria-invalid={!!errors.birth_year}
            aria-describedby={errors.birth_year ? "birth_year-error" : undefined}
          />
          {errors.birth_year && (
            <p
              id="birth_year-error"
              role="alert"
              className="mt-1.5 text-red-600 text-sm leading-relaxed"
            >
              {errors.birth_year.message}
            </p>
          )}
        </div>
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
