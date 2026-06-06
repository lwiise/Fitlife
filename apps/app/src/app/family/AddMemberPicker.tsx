"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  UserPlus,
  User,
  Baby,
  HeartPulse,
  ChefHat,
  Minus,
  Plus,
} from "lucide-react";

type Option = {
  type: string;
  label: string;
  Icon: typeof User;
  // Multi-capable types show a count stepper; singular ones add exactly one.
  quantity: boolean;
};

// Singular first (one spouse, one housekeeper per household), then the
// multi-capable types that support a quantity.
const OPTIONS: Option[] = [
  { type: "husband", label: "زوج", Icon: User, quantity: false },
  { type: "housekeeper", label: "خدامة تطبخ للعائلة", Icon: ChefHat, quantity: false },
  { type: "adult", label: "بالغ ثاني", Icon: UserPlus, quantity: true },
  { type: "child", label: "طفل", Icon: Baby, quantity: true },
  { type: "preg", label: "امرأة حامل/مرضعة", Icon: HeartPulse, quantity: true },
];

const MAX = 8;

export function AddMemberPicker() {
  const router = useRouter();
  // One count per multi-capable type; default 1, clamped 1–MAX.
  const [counts, setCounts] = useState<Record<string, number>>({
    adult: 1,
    child: 1,
    preg: 1,
  });

  const go = (type: string, count?: number) =>
    router.push(`/family/add?type=${type}${count ? `&count=${count}` : ""}`);

  const setCount = (type: string, n: number) =>
    setCounts((c) => ({ ...c, [type]: Math.min(MAX, Math.max(1, n)) }));

  return (
    <div className="bg-white rounded-2xl p-5 border border-dashed border-brand-purple-900/30">
      <p className="font-bold text-brand-ink text-sm mb-3">إضافة فرد جديد</p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          if (!o.quantity) {
            return (
              <button
                key={o.type}
                type="button"
                onClick={() => go(o.type)}
                className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-brand-ink/10 bg-brand-surface/50 px-4 py-3 text-sm font-bold text-brand-ink hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
              >
                <o.Icon className="size-4 text-brand-purple-900" aria-hidden="true" />
                {o.label}
              </button>
            );
          }

          const count = counts[o.type] ?? 1;
          return (
            <div
              key={o.type}
              className="col-span-2 flex items-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-surface/50 p-1.5 ps-3"
            >
              <button
                type="button"
                onClick={() => go(o.type, count)}
                className="flex-1 inline-flex items-center gap-2 min-h-11 rounded-lg px-2 text-start text-sm font-bold text-brand-ink hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
              >
                <o.Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
                {o.label}
              </button>
              <div className="flex items-center gap-0.5 bg-white rounded-lg border border-brand-ink/10 p-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCount(o.type, count - 1)}
                  disabled={count <= 1}
                  aria-label={`إنقاص عدد ${o.label}`}
                  className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span
                  className="w-6 text-center font-bold text-brand-ink tabular-nums"
                  aria-live="polite"
                  aria-label={`العدد ${count}`}
                >
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => setCount(o.type, count + 1)}
                  disabled={count >= MAX}
                  aria-label={`زيادة عدد ${o.label}`}
                  className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
