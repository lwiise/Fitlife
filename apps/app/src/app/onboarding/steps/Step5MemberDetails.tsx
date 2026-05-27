"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step4Schema, step5Schema } from "../schema";
import { LOCALE_CODES_ORDERED, LOCALE_INFO } from "@/lib/plans/locales";

type Composition = z.infer<typeof step4Schema>;
type FormData = z.infer<typeof step5Schema>;
type Member = FormData["members"][number];

// Arabic name + native name, e.g. "الفلبينية (Tagalog)". Arabic itself stays "العربية".
const LANGUAGE_OPTIONS: Array<{ value: Member["preferred_language"]; label: string }> =
  LOCALE_CODES_ORDERED.map((code) => {
    const info = LOCALE_INFO[code];
    return {
      value: code,
      label: code === "ar" ? info.native_name : `${info.ar_name} (${info.native_name})`,
    };
  });

function defaultMembers(composition: Composition): Member[] {
  const out: Member[] = [];
  if (composition.has_partner) {
    out.push({
      name: "",
      role: "dad",
      birth_year: 0,
      preferred_language: "ar",
    });
  }
  for (let i = 0; i < composition.num_children; i++) {
    out.push({
      name: "",
      role: "son",
      birth_year: 0,
      preferred_language: "ar",
    });
  }
  if (composition.has_housekeeper) {
    // No birth_year — she's the cook, not a plan member.
    out.push({
      name: "",
      role: "housekeeper",
      preferred_language: "tl",
    });
  }
  return out;
}

function memberHeadline(role: Member["role"], idx: number, childIdx: number) {
  if (role === "dad") return "زوجك";
  if (role === "housekeeper") return "معلومات الخدامة لتجهيز تعليمات الطبخ";
  if (role === "son" || role === "daughter") return `الطفل ${childIdx + 1}`;
  return `فرد ${idx + 1}`;
}

export function Step5MemberDetails({
  composition,
  defaultValues,
  onSubmit,
  isPending,
}: {
  composition: Composition;
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
}) {
  const initialMembers = useMemo(
    () => defaultValues?.members ?? defaultMembers(composition),
    [composition, defaultValues],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step5Schema),
    defaultValues: { members: initialMembers },
  });

  const { fields } = useFieldArray({ control, name: "members" });

  // If composition changes (user went back to Step 4 and toggled), regenerate.
  useEffect(() => {
    if (!defaultValues) {
      reset({ members: defaultMembers(composition) });
    }
  }, [composition, defaultValues, reset]);

  if (fields.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
            حدثيني عن أفراد عائلتك
          </h2>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            ما اخترتي أي أحد في الخطوة السابقة — تقدري ترجعي وتعدلي، أو نكمل بدون.
          </p>
        </header>
        <button
          type="button"
          onClick={() => onSubmit({ members: [] })}
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
      </div>
    );
  }

  let childCounter = -1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          حدثيني عن أفراد عائلتك
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          لكل واحد نحضّر خطته الخاصة.
        </p>
      </header>

      <div className="space-y-4">
        {fields.map((field, idx) => {
          const role = field.role;
          const isChild = role === "son" || role === "daughter";
          if (isChild) childCounter += 1;

          return (
            <div
              key={field.id}
              className="bg-white rounded-2xl border border-brand-ink/10 p-5 space-y-3"
            >
              <h3 className="font-bold text-brand-ink text-lg">
                {memberHeadline(role, idx, childCounter)}
              </h3>

              {isChild && (
                <Controller
                  control={control}
                  name={`members.${idx}.role`}
                  render={({ field: roleField }) => (
                    <div className="inline-flex rounded-full bg-brand-surface p-1 border border-brand-ink/10">
                      <button
                        type="button"
                        onClick={() => roleField.onChange("son")}
                        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                          roleField.value === "son"
                            ? "bg-brand-ink text-white"
                            : "text-brand-ink-muted hover:text-brand-ink"
                        }`}
                      >
                        ولد
                      </button>
                      <button
                        type="button"
                        onClick={() => roleField.onChange("daughter")}
                        className={`min-h-[2.75rem] px-5 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
                          roleField.value === "daughter"
                            ? "bg-brand-ink text-white"
                            : "text-brand-ink-muted hover:text-brand-ink"
                        }`}
                      >
                        بنت
                      </button>
                    </div>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={role === "housekeeper" ? "col-span-2" : undefined}>
                  <label
                    htmlFor={`name-${idx}`}
                    className="block text-xs font-bold text-brand-ink mb-1"
                  >
                    الاسم
                  </label>
                  <input
                    id={`name-${idx}`}
                    type="text"
                    disabled={isPending}
                    spellCheck={false}
                    className="w-full px-3 py-2 rounded-lg border border-brand-ink/10 bg-brand-surface text-brand-ink text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 transition-colors"
                    {...register(`members.${idx}.name`)}
                    aria-invalid={!!errors.members?.[idx]?.name}
                  />
                  {errors.members?.[idx]?.name && (
                    <p role="alert" className="mt-1 text-red-600 text-xs">
                      {errors.members[idx]?.name?.message}
                    </p>
                  )}
                </div>
                {role !== "housekeeper" && (
                  <div>
                    <label
                      htmlFor={`birth-${idx}`}
                      className="block text-xs font-bold text-brand-ink mb-1"
                    >
                      سنة الميلاد
                    </label>
                    <input
                      id={`birth-${idx}`}
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      disabled={isPending}
                      className="w-full px-3 py-2 rounded-lg border border-brand-ink/10 bg-brand-surface text-brand-ink text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 transition-colors"
                      {...register(`members.${idx}.birth_year`, { valueAsNumber: true })}
                      aria-invalid={!!errors.members?.[idx]?.birth_year}
                    />
                    {errors.members?.[idx]?.birth_year && (
                      <p role="alert" className="mt-1 text-red-600 text-xs">
                        اكتبي سنة صحيحة
                      </p>
                    )}
                  </div>
                )}
              </div>

              {role === "housekeeper" && (
                <div>
                  <label
                    htmlFor={`lang-${idx}`}
                    className="block text-xs font-bold text-brand-ink mb-1"
                  >
                    بأي لغة تقرأ الخدامة الوصفات؟
                  </label>
                  <select
                    id={`lang-${idx}`}
                    disabled={isPending}
                    className="w-full px-3 py-2 rounded-lg border border-brand-ink/10 bg-brand-surface text-brand-ink text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 transition-colors"
                    {...register(`members.${idx}.preferred_language`)}
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
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
