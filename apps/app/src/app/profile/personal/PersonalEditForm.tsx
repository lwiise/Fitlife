"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { saveMomPersonalInfo } from "../actions";
import { genderPick } from "@/lib/copy/gender";

const currentYear = new Date().getFullYear();

// Validation copy is gendered too — a male owner shouldn't be told "اكتبي".
// The schema is built per-owner from the answered sex.
const makeSchema = (g: (feminine: string, masculine: string) => string) =>
  z.object({
    display_name: z.string().min(2, "الاسم لازم يكون حرفين أو أكثر").max(50),
    birth_year: z
      .number({ invalid_type_error: g("اكتبي سنة الميلاد", "اكتب سنة الميلاد") })
      .int()
      .min(1940, "السنة لازم تكون بعد 1940")
      .max(currentYear - 13, g("لازم تكوني فوق 13 سنة", "لازم تكون فوق 13 سنة")),
    sex: z.enum(["female", "male"]),
    height_cm: z
      .number({ invalid_type_error: g("اكتبي طولك", "اكتب طولك") })
      .min(120, "الطول قليل")
      .max(220, "الطول مرتفع"),
    weight_kg: z
      .number({ invalid_type_error: g("اكتبي وزنك", "اكتب وزنك") })
      .min(30, "الوزن قليل")
      .max(250, "الوزن مرتفع"),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

const FIELD =
  "w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:border-transparent transition-colors";

export function PersonalEditForm({
  initial,
}: {
  initial: Partial<FormData>;
}) {
  const router = useRouter();
  const g = genderPick(initial.sex);
  const schema = useMemo(() => makeSchema(genderPick(initial.sex)), [initial.sex]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: initial.display_name ?? "",
      birth_year: initial.birth_year,
      sex: initial.sex ?? "female",
      height_cm: initial.height_cm,
      weight_kg: initial.weight_kg,
    },
  });

  const onSubmit = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await saveMomPersonalInfo(data);
      if (!result.ok) return setError(result.error);
      router.push("/profile?saved=1");
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
          المعلومات الشخصية
        </h1>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          {g("عدّلي اسمك وبياناتك الأساسية.", "عدّل اسمك وبياناتك الأساسية.")}
        </p>
      </header>

      <div>
        <label htmlFor="display_name" className="block text-sm font-bold text-brand-ink mb-2">
          الاسم
        </label>
        <input
          id="display_name"
          type="text"
          disabled={isPending}
          className={FIELD}
          {...register("display_name")}
          aria-invalid={!!errors.display_name}
        />
        {errors.display_name && (
          <p role="alert" className="mt-1.5 text-red-600 text-sm">
            {errors.display_name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="birth_year" className="block text-sm font-bold text-brand-ink mb-2">
          سنة الميلاد
        </label>
        <input
          id="birth_year"
          type="number"
          inputMode="numeric"
          dir="ltr"
          placeholder="1990"
          disabled={isPending}
          className={FIELD}
          {...register("birth_year", { valueAsNumber: true })}
          aria-invalid={!!errors.birth_year}
        />
        {errors.birth_year && (
          <p role="alert" className="mt-1.5 text-red-600 text-sm">
            {errors.birth_year.message}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-bold text-brand-ink mb-2">الجنس</legend>
        <Controller
          name="sex"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "female", label: "أنثى" },
                { value: "male", label: "ذكر" },
              ].map((o) => {
                const active = field.value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => field.onChange(o.value)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                      active
                        ? "border-brand-purple-900 bg-brand-purple-900/5"
                        : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="height_cm" className="block text-sm font-bold text-brand-ink mb-2">
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
              className={`${FIELD} pe-12`}
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
            <p role="alert" className="mt-1.5 text-red-600 text-sm">
              {errors.height_cm.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="weight_kg" className="block text-sm font-bold text-brand-ink mb-2">
            الوزن
          </label>
          <div className="relative" dir="ltr">
            <input
              id="weight_kg"
              type="number"
              inputMode="decimal"
              dir="ltr"
              step="0.1"
              placeholder="65"
              disabled={isPending}
              className={`${FIELD} pe-12`}
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
            <p role="alert" className="mt-1.5 text-red-600 text-sm">
              {errors.weight_kg.message}
            </p>
          )}
        </div>
      </div>

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
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-full bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white text-sm font-bold transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
        >
          {isPending && (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          حفظ
        </button>
      </div>
    </form>
  );
}
