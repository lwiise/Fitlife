/**
 * Does editing a family member change anything the plan is built from?
 *
 * This used to be a hand-maintained list of field comparisons inside
 * updateFamilyMember, and it silently omitted allergies, height_cm, dislikes,
 * trimester and months_postpartum — so adding a nut allergy to a child saved
 * the row and left the nut-containing plan on screen. Diffing the whole built
 * row can't drift as buildMemberRow grows.
 *
 * Lives outside the "use server" action module so it can be unit-tested (every
 * export of a server-action file must be an async function).
 */

/**
 * Fields that change how a member READS but not what the engine plans.
 * `name` shows through the read-time overlay (applyMemberDisplayNames);
 * `user_id` never changes; `preferred_language` only matters for the
 * housekeeper, whose language change triggers a translation pass of its own
 * (addHousekeeper), not a regeneration.
 */
export const COSMETIC_MEMBER_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "user_id",
  "preferred_language",
]);

/** Postgres hands numerics back as strings sometimes; jsonb as parsed values. */
export function sameFieldValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

/**
 * True when the edit warrants a regeneration. Compares every key of the newly
 * built row against the stored row, skipping the cosmetic ones. A missing
 * `before` (row vanished) counts as substantive.
 */
export function memberEditIsSubstantive(
  before: Record<string, unknown> | null | undefined,
  row: Record<string, unknown>,
): boolean {
  if (!before) return true;
  for (const [key, next] of Object.entries(row)) {
    if (COSMETIC_MEMBER_FIELDS.has(key)) continue;
    if (!sameFieldValue(before[key], next)) return true;
  }
  return false;
}
