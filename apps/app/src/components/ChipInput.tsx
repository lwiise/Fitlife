"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

/**
 * Free-text tag input (chips). Add with Enter or comma, remove with the × or
 * Backspace on an empty field. Fully RTL + keyboard accessible.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  id,
  disabled,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Persistent accessible name — the placeholder disappears once a chip
   * exists, leaving the field nameless without this. */
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const t = raw.trim();
    // Caps mirror the server's chipArray schema (30 items × 80 chars) so a
    // violation can't surface as a cryptic end-of-wizard rejection.
    if (!t || value.includes(t) || value.length >= 30) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-2 rounded-xl border border-brand-ink/10 bg-white p-2 focus-within:ring-2 focus-within:ring-brand-purple-900 ${disabled ? "opacity-50" : ""}`}
    >
      {value.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-brand-lavender/40 text-brand-purple-900 text-sm font-medium ps-3 pe-1 py-1"
        >
          {chip}
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={disabled}
            aria-label={`حذف ${chip}`}
            className="inline-flex items-center justify-center size-6 rounded-full hover:bg-brand-purple-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        maxLength={80}
        placeholder={value.length === 0 ? placeholder : undefined}
        spellCheck={false}
        className="flex-1 min-w-[8rem] bg-transparent px-2 py-2 text-brand-ink placeholder:text-brand-ink-muted/40 focus-visible:outline-none"
      />
    </div>
  );
}
