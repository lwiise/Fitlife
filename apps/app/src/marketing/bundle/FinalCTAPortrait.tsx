import Image from "next/image";

/**
 * The closing section's portrait — the result the copy promises, shown rather
 * than illustrated.
 *
 * It is FRAMED rather than dropped in loose. The photograph's own backdrop is a
 * warm plum (#3E2B2C), a step lighter and warmer than this section's night
 * field, so a bare rectangle reads as a mismatched patch of background. Inside a
 * rounded card with a hairline and the page's gold top edge it becomes a
 * deliberate object instead — the same paper-and-edge language the ValueStack
 * gifts panel uses.
 *
 * The `src` is a plain path, NOT a static import. A static import needs the
 * `*.webp` module declaration that `next-env.d.ts` pulls in, and that file is
 * generated and gitignored — so `tsc --noEmit` passes locally (where a previous
 * build left one behind) and fails in CI, which type-checks before it builds.
 * The card carries the photo's own backdrop colour so the image resolves onto a
 * matching tone instead of flashing.
 *
 * 4:5 matches the source exactly, so nothing is cropped or letterboxed. The
 * section sits well below the fold, so this stays lazy (next/image's default)
 * and never competes with the hero for the LCP.
 */
export function FinalCTAPortrait() {
  return (
    <div className="edge-gold relative mx-auto w-full max-w-[19rem] overflow-hidden rounded-3xl bg-[#3e2b2c] ring-1 ring-white/12 lg:max-w-md">
      <Image
        src="/final-cta-woman.webp"
        alt="امرأة بملابس رياضية بعد تمرينها، تنظر أمامها بثقة وابتسامة هادئة"
        width={1122}
        height={1402}
        sizes="(min-width: 1024px) 28rem, 19rem"
        className="h-auto w-full"
      />
      {/* Grounds the photograph in the section: its backdrop is warmer than the
          night field, so the bottom edge dissolves into the page instead of
          ending on a line. Pointer-events-none — it is pure atmosphere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-brand-purple-950/85 to-transparent"
      />
    </div>
  );
}
