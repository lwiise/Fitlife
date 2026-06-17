import { Info } from "lucide-react";

/**
 * Zero-JS info affordance: a small icon button that reveals a tooltip card on
 * hover or keyboard focus. The full text is also folded into the button's
 * accessible name, so screen-reader and keyboard users get it without the
 * pointer-only popover. Used for "approximate" / "% of revenue" notes that must
 * NOT live in body copy.
 */
export function InfoTooltip({ text, label }: { text: string; label: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${label}: ${text}`}
        className="inline-flex size-11 items-center justify-center rounded-full text-brand-ink-muted transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple-900"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full start-0 z-20 mb-2 hidden w-max max-w-56 rounded-lg border border-brand-ink/10 bg-surface-elevated px-3 py-2 text-start text-xs leading-snug text-brand-ink shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
