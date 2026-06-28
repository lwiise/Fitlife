"use client";

// Shared step primitives for the opt-in exercise wizard. Class names are copied
// verbatim from the meal wizard (MemberWizard.tsx / MomWizard.tsx) so the appended
// exercise steps are visually indistinguishable from the meal flow — the approved
// "seamless" direction. Reused by MemberWizard (inline) and the Mom exercise screen.

import { Loader2 } from "lucide-react";

export function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header>
      <h2 className="font-extrabold text-3xl text-brand-ink leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}

export function OptionButton({
  active,
  onClick,
  children,
  full,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-brand-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
        full ? "w-full text-start" : ""
      } ${
        active
          ? "border-brand-purple-900 bg-brand-purple-900/5"
          : "border-brand-ink/10 bg-white hover:border-brand-ink/20"
      }`}
    >
      {children}
    </button>
  );
}

// Multi-select pill group. `accent="pink"` mirrors the existing medical-condition
// chips (used for the safety/symptom screen); default purple matches preference chips.
export function PillGroup<T extends string | number>({
  options,
  selected,
  onToggle,
  ariaLabel,
  accent = "purple",
}: {
  options: { value: T; label_ar: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  ariaLabel: string;
  accent?: "purple" | "pink";
}) {
  // Pink branch mirrors the existing medical-condition chips, hover included.
  const inactiveCls =
    accent === "pink"
      ? "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-pink/40"
      : "border-brand-ink/10 bg-white text-brand-ink hover:border-brand-ink/20";
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        const activeCls =
          accent === "pink"
            ? "border-brand-pink bg-brand-pink-light text-brand-pink"
            : "border-brand-purple-900 bg-brand-purple-900/5 text-brand-ink";
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={active}
            className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 ${
              active ? activeCls : inactiveCls
            }`}
          >
            {o.label_ar}
          </button>
        );
      })}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-brand-ink mb-2">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        dir="ltr"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink tabular-nums placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      />
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-brand-ink mb-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-white text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      />
    </div>
  );
}

export function PrimaryButton({
  onClick,
  isPending,
  children,
}: {
  onClick: () => void;
  isPending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      {isPending && (
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
