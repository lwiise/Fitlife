// Gendered-copy helper for the onboarding questionnaire. The product's voice
// is feminine أنتِ by default (CLAUDE.md); masculine forms apply only after a
// male account owner answers the الجنس question. Never dual-write ("اختاري/اختر")
// — pick one form per Coach Sara's فصحى directive.

export type OwnerSex = "female" | "male";

/**
 * Returns a picker bound to the answered sex. Feminine is the fallback for
 * null/undefined (the question not yet answered, or legacy profiles).
 *
 *   const g = genderPick(sex);
 *   g("اختاري هدفك", "اختر هدفك")
 */
export function genderPick(sex: string | null | undefined) {
  const male = sex === "male";
  return (feminine: string, masculine: string): string =>
    male ? masculine : feminine;
}
