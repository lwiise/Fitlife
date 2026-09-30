import { clsx } from "clsx";
import { AvatarPhoto } from "./avatar-photo";

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

// The photo layer (a small client island, see its note); re-exported so the
// avatar vocabulary stays one import.
export { AvatarPhoto };

export function Avatar({
  name,
  rosterIndex,
  src,
  size = "md",
  className,
}: {
  name: string;
  rosterIndex: number;
  /** The person's profile photo URL (householdPhotoSrcs); the initial when absent. */
  src?: string | null;
  /** sm 24px (stacks), md 32px (lists), lg 40px (the plan bar's identity).
   * A className size override only wins when it is LARGER than the variant's
   * (Tailwind emits size-* in numeric order, text-* not), so take the nearest
   * variant below and override the box only — e.g. lg + "size-11". */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "relative grid shrink-0 place-items-center rounded-full font-extrabold text-white",
        size === "sm" ? "size-6 text-[11px]" : size === "lg" ? "size-10 text-base" : "size-8 text-sm",
        avatarColor(rosterIndex),
        className,
      )}
    >
      {initialOf(name)}
      {src && <AvatarPhoto src={src} px={size === "sm" ? 24 : size === "lg" ? 40 : 32} />}
    </span>
  );
}

/** Overlapping avatars: who eats this dish, at a glance. */
export function AvatarStack({
  people,
  max = 5,
}: {
  people: Array<{ id: string; name: string; rosterIndex: number; src?: string | null }>;
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
          src={p.src}
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
