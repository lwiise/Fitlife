import { clsx } from "clsx";

// Stable member colours by ROSTER position (never by rank or sort order), so a
// person keeps their colour everywhere in the app. Brand hues plus one warm
// neutral; white text clears 4.5:1 on each.
const AVATAR_BG = [
  "bg-brand-pink",
  "bg-brand-purple-900",
  "bg-[#7B55B8]",
  "bg-[#A55F24]",
  "bg-[#0B6E5B]",
  "bg-[#5B5670]",
];

/** A name's first letter for an avatar. An isolated «ه» reads as the digit
 * «٥» beside Arabic-Indic numerals, so it is shown in its initial form «هـ». */
export function initialOf(name: string | null | undefined): string {
  const ch = name?.trim().charAt(0) ?? "";
  if (!ch) return "؟";
  return ch === "ه" ? "هـ" : ch;
}

export function avatarColor(rosterIndex: number) {
  return AVATAR_BG[((rosterIndex % AVATAR_BG.length) + AVATAR_BG.length) % AVATAR_BG.length]!;
}

export function Avatar({
  name,
  rosterIndex,
  size = "md",
  className,
}: {
  name: string;
  rosterIndex: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "grid shrink-0 place-items-center rounded-full font-extrabold text-white",
        size === "sm" ? "size-6 text-[11px]" : "size-8 text-sm",
        avatarColor(rosterIndex),
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}

/** Overlapping initials: who eats this dish, at a glance. */
export function AvatarStack({
  people,
  max = 5,
}: {
  people: Array<{ id: string; name: string; rosterIndex: number }>;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center" aria-hidden="true">
      {shown.map((p, i) => (
        <Avatar
          key={p.id}
          name={p.name}
          rosterIndex={p.rosterIndex}
          size="sm"
          className={clsx("ring-2 ring-brand-card", i > 0 && "-ms-1.5")}
        />
      ))}
      {extra > 0 && (
        <span className="-ms-1.5 grid size-6 place-items-center rounded-full bg-brand-tint text-[11px] font-extrabold text-brand-purple-900 ring-2 ring-brand-card">
          +{extra}
        </span>
      )}
    </span>
  );
}
