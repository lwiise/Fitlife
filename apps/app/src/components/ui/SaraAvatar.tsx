import Image from "next/image";
import { clsx } from "clsx";

/** Sara's real photo. The repo has no photo yet (owner to supply) — until
 * SARA_PHOTO is set, a neutral brand mark is shown. NEVER an initial (owner
 * directive): a letter in a circle reads as one more household member, and
 * Sara is the coach, not a person on the roster.
 *
 * Asserted rather than annotated, so TypeScript keeps the photo branch below
 * typed instead of narrowing it away while the value is null. */
export const SARA_PHOTO = null as { src: string; width: number; height: number } | null;

const BOX = { 24: "size-6", 40: "size-10", 56: "size-14" } as const;

// /logo-compact.png is 520×428, cropped to its content (see Logo.tsx).
const MARK = { src: "/logo-compact.png", width: 520, height: 428 } as const;

export function SaraAvatar({
  size,
  alt = "",
  className,
}: {
  size: 24 | 40 | 56;
  /** Empty (the default) when the name is already written beside her. */
  alt?: string;
  className?: string;
}) {
  if (SARA_PHOTO) {
    return (
      <Image
        src={SARA_PHOTO.src}
        alt={alt}
        width={size}
        height={size}
        className={clsx("shrink-0 rounded-full object-cover", BOX[size], className)}
      />
    );
  }

  // The mark at ~70% of the disc, requested at its rendered size so the
  // optimizer serves a thumbnail, not the 520px source.
  const w = Math.round(size * 0.7);
  const h = Math.round((w * MARK.height) / MARK.width);
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center rounded-full bg-brand-tint",
        BOX[size],
        className,
      )}
    >
      <Image src={MARK.src} alt={alt} width={w} height={h} className="h-auto w-[70%] object-contain" />
    </span>
  );
}
