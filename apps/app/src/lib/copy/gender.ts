// Gendered-copy helper. Arabic inflects for gender (pronouns أنتِ/أنتَ,
// possessives ـكِ/ـكَ, imperatives اختاري/اختر, present verbs تختارين/تختار,
// adjectives حاضرة/حاضر). The product's voice is feminine أنتِ by default
// (CLAUDE.md, audience = Gulf housewives), but two subjects can be male:
//   • the ACCOUNT OWNER — masculine forms apply once a male owner answers the
//     الجنس question (profiles.sex). Marketing/pre-signup copy stays feminine
//     (the owner's sex isn't known yet).
//   • a specific FAMILY MEMBER — text ABOUT or a status label FOR one member
//     (e.g. «حاضر/حاضرة» in «موسم بيتنا») follows THAT member's sex
//     (family_members.sex, or profiles.sex when the member is "mom").
// Whole-household ("بيتكم"، "اجتمعتم") copy stays masculine-plural — the
// grammatically inclusive default — and is NOT dual-written per person.
// Never dual-write ("اختاري/اختر") — pick one form per Coach Sara's فصحى
// directive.

export type OwnerSex = "female" | "male";

/**
 * Returns a picker bound to the answered sex. Pass the OWNER's sex for
 * owner-directed ("you") copy, or a MEMBER's sex for text about that member.
 * Feminine is the fallback for null/undefined (the question not yet answered,
 * or legacy profiles) — the historical default voice.
 *
 *   const g = genderPick(sex);
 *   g("اختاري هدفك", "اختر هدفك")
 */
export function genderPick(sex: string | null | undefined) {
  const male = sex === "male";
  return (feminine: string, masculine: string): string =>
    male ? masculine : feminine;
}
