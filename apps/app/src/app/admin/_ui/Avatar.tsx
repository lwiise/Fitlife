import { clsx } from "clsx";

/**
 * The first letter of a name for an avatar. A lone Arabic «ه» is drawn as «هـ»
 * so it reads as a letter rather than a circle; an empty name gives «؟».
 */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim())[0];
  if (!first) return "؟";
  if (first === "ه") return "هـ";
  return first.toLocaleUpperCase();
}

/** A 32px round initial (`.ad-avatar`). Decorative: the name is shown beside it. */
export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span aria-hidden="true" className={clsx("ad-avatar", className)}>
      {initialOf(name)}
    </span>
  );
}
