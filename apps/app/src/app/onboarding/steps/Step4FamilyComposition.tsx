"use client";

import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, AlertTriangle } from "lucide-react";
import type { z } from "zod";
import { step4Schema } from "../schema";

type FormData = z.infer<typeof step4Schema>;

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

export function Step4FamilyComposition({
  defaultValues,
  onSubmit,
  isPending,
  tierLimit,
}: {
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  tierLimit: number | null;
}) {
  const {
    handleSubmit,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: defaultValues ?? {
      has_partner: false,
      num_children: 0,
      has_housekeeper: false,
    },
  });

  const hasPartner = useWatch({ control, name: "has_partner" });
  const numChildren = useWatch({ control, name: "num_children" });

  // Beneficiary count = Mom + partner (if any) + children. Housekeeper excluded.
  const beneficiaryCount =
    1 + (hasPartner ? 1 : 0) + (typeof numChildren === "number" ? numChildren : 0);

  const overTier =
    tierLimit !== null && beneficiaryCount > tierLimit;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
          إيش يتألف بيتك؟
        </h2>
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          اختاري الأعضاء — نسجلهم في الخطوة الجاية.
        </p>
      </header>

      {overTier && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl border-2 border-brand-yellow/40 bg-brand-yellow/15 px-4 py-3"
        >
          <AlertTriangle
            className="size-5 flex-shrink-0 mt-0.5 text-brand-ink"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-brand-ink text-sm font-medium leading-relaxed">
              خطتك الحالية تسمح بـ {tierLimit} {tierLimit === 1 ? "شخص" : "أشخاص"} فقط، عائلتك {beneficiaryCount} أفراد.
            </p>
            <a
              href="/pricing"
              className="inline-block mt-1 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-yellow/15 rounded-md"
            >
              ترقي للفاميلي
            </a>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-brand-ink/10 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-brand-ink text-base">عندك زوج؟</p>
          </div>
          <Controller
            name="has_partner"
            control={control}
            render={({ field }) => (
              <YesNo value={!!field.value} onChange={field.onChange} disabled={isPending} />
            )}
          />
        </div>

        <div className="bg-white rounded-2xl border border-brand-ink/10 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-brand-ink text-base">كم طفل عندك؟</p>
            <p className="text-brand-ink-muted text-xs mt-0.5">من 0 إلى 8</p>
          </div>
          <Controller
            name="num_children"
            control={control}
            render={({ field }) => {
              const current = typeof field.value === "number" ? field.value : 0;
              return (
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(Math.max(0, current - 1))}
                    disabled={isPending || current === 0}
                    aria-label="إنقاص"
                    className="size-11 rounded-full bg-brand-surface border border-brand-ink/10 text-brand-ink flex items-center justify-center hover:bg-brand-ink hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="font-extrabold text-brand-ink text-2xl tabular-nums min-w-[2rem] text-center">
                    {current}
                  </span>
                  <button
                    type="button"
                    onClick={() => field.onChange(Math.min(8, current + 1))}
                    disabled={isPending || current === 8}
                    aria-label="زيادة"
                    className="size-11 rounded-full bg-brand-surface border border-brand-ink/10 text-brand-ink flex items-center justify-center hover:bg-brand-ink hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              );
            }}
          />
        </div>

        <div className="bg-white rounded-2xl border border-brand-ink/10 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-brand-ink text-base">عندك خادمة بالبيت؟</p>
            <p className="text-brand-ink-muted text-xs mt-0.5">
              نحضّر لها خطة بلغتها
            </p>
          </div>
          <Controller
            name="has_housekeeper"
            control={control}
            render={({ field }) => (
              <YesNo value={!!field.value} onChange={field.onChange} disabled={isPending} />
            )}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
      >
        التالي
      </button>
    </form>
  );
}
