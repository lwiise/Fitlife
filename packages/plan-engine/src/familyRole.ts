/**
 * `family_members.role = 'dad'` is the ACCOUNT OWNER'S SPOUSE, of either sex.
 *
 * The token predates male account owners, and 00001's CHECK has no other value
 * for a spouse, so a man's wife is stored as 'dad' too and her own `sex` column
 * says which. Every label derived from the role must therefore read `sex` as
 * well: a wife is «الزوجة», never «الزوج» or «الأب».
 *
 * Until 09/2026 a male owner's wife was stored as 'other_adult' instead. Her
 * wizard was then titled «إضافة فرد بالغ» and asked her sex, the plan prompt
 * called her «فرد بالغ», and the «زوجة» row never hid once she was added.
 *
 * A leaf module (no imports) so client components can take it from the
 * `@fitlife/plan-engine/familyRole` subpath without pulling in the engine.
 */
export const SPOUSE_ROLE = "dad";

export function isSpouseRole(role: string | null | undefined): boolean {
  return role === SPOUSE_ROLE;
}

/**
 * The spouse's sex, from the OWNER's answered sex: always the opposite. An
 * unanswered owner is the product's feminine fallback, so her spouse is a
 * husband, which is what every spouse was before male owners existed.
 */
export function spouseSexFor(ownerSex: string | null | undefined): "male" | "female" {
  return ownerSex === "male" ? "female" : "male";
}

const ROLE_LABELS_AR: Record<string, string> = {
  son: "ابن",
  daughter: "ابنة",
  housekeeper: "الخادمة",
  other_adult: "فرد بالغ",
  other_child: "طفل آخر",
};

/**
 * The Arabic relation label for a member's role, as the plan prompt and the
 * advisor read it. The spouse's label follows their own sex; a spouse row with
 * no sex on file is a husband (the historical default for this role).
 */
export function familyRoleLabelAr(role: string, sex?: string | null): string {
  if (isSpouseRole(role)) return sex === "female" ? "الزوجة" : "الزوج";
  return ROLE_LABELS_AR[role] ?? role;
}
