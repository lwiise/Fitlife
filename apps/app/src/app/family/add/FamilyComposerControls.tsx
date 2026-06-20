"use client";

import { Check, Minus, Plus, User } from "lucide-react";

// Tier limits are enforced server-side; this is the per-type stepper ceiling so a
// single batch stays sane. Shared by both family composers.
export const MAX = 8;

/** A singular role (husband, housekeeper): a tappable checkbox row. */
export function CheckRow({
  label,
  Icon,
  checked,
  onToggle,
}: {
  label: string;
  Icon: typeof User;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 min-h-11 rounded-xl border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        checked
          ? "border-brand-purple-900 bg-brand-lavender/30 text-brand-ink"
          : "border-brand-ink/10 bg-brand-surface/50 text-brand-ink hover:border-brand-purple-900/40"
      }`}
    >
      <span
        className={`size-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? "bg-brand-purple-900 border-brand-purple-900" : "border-brand-ink/20 bg-white"
        }`}
      >
        {checked && <Check className="size-4 text-white" aria-hidden="true" />}
      </span>
      <Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
}

/** A repeatable role (adult, child, pregnant/lactating): a 0-default −/＋ stepper. */
export function StepperRow({
  label,
  Icon,
  value,
  onChange,
}: {
  label: string;
  Icon: typeof User;
  value: number;
  onChange: (n: number) => void;
}) {
  const set = (n: number) => onChange(Math.min(MAX, Math.max(0, n)));
  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-surface/50 p-1.5 ps-4">
      <Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm font-bold text-brand-ink">{label}</span>
      <div className="flex items-center gap-0.5 bg-white rounded-lg border border-brand-ink/10 p-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 0}
          aria-label={`إنقاص عدد ${label}`}
          className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span
          className="w-6 text-center font-bold text-brand-ink tabular-nums"
          aria-live="polite"
          aria-label={`${label}: ${value}`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => set(value + 1)}
          disabled={value >= MAX}
          aria-label={`زيادة عدد ${label}`}
          className="size-11 inline-flex items-center justify-center rounded-md text-brand-ink hover:bg-brand-surface disabled:text-brand-ink/25 disabled:hover:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
