import { cn } from "@/lib/utils";

// The page's section index — a gold tabular numeral and a rule that draws
// across as the section reveals. Purely decorative (the heading below it is
// the real landmark), so it is hidden from assistive tech.
//
// The rule rides its ancestor's reveal via `rule-grow` rather than observing
// itself: one observer entry per section, and with no JS it just sits at full
// width like any other hairline.
export function SectionEyebrow({
  index,
  className,
}: {
  index: string;
  className?: string;
}) {
  return (
    <p
      aria-hidden
      className={cn(
        "text-gold-700 flex items-center gap-3 text-sm font-extrabold tabular-nums",
        className,
      )}
    >
      {index}
      <span className="rule-grow bg-gold-700/45 h-px w-14" />
    </p>
  );
}
