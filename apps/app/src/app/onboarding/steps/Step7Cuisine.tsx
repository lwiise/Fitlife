"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { step7Schema } from "../schema";

type FormData = z.infer<typeof step7Schema>;

const CUISINE_OPTIONS: Array<{
  value: FormData["cuisine_preference"];
  label: string;
  sublabel: string;
}> = [
  { value: "khaleeji", label: "خليجي", sublabel: "كبسة، مندي، مقلوبة..." },
  { value: "mixed", label: "خليط", sublabel: "خليجي + عالمي" },
  {
    value: "mediterranean",
    label: "متوسطي",
    sublabel: "يوناني، لبناني، تركي...",
  },
];

export function Step7Cuisine({
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
    resolver: zodResolver(step7Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          أي مطبخ تفضلين؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          نلتزم بأكلكم المفضل في الخطة.
        </p>
      </header>

      <Controller
        name="cuisine_preference"
        control={control}
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="sr-only">المطبخ المفضل</legend>
            {CUISINE_OPTIONS.map((opt) => {
              const checked = field.value === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`block rounded-2xl border-2 px-4 py-4 cursor-pointer transition-colors min-h-[3.5rem] ${
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
                  <div className="font-bold text-brand-ink text-base">{opt.label}</div>
                  <div className="text-brand-ink-muted text-xs mt-0.5">
                    {opt.sublabel}
                  </div>
                </label>
              );
            })}
          </fieldset>
        )}
      />
      {errors.cuisine_preference && (
        <p role="alert" className="text-red-600 text-sm leading-relaxed">
          اختاري المطبخ المفضل
        </p>
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
        التالي
      </button>
    </form>
  );
}
