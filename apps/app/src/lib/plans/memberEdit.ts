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


/**
 * Members whose stored row is NEWER than the plan that was built from it.
 *
 * `updateFamilyMember` regenerates on a substantive edit — unless a run already
 * holds the lock, in which case it returns `{ ok: true, plan_generation_id:
 * null }` under a comment saying "defer the regen". Nothing deferred it. The
 * drain only picks members with MISSING days, and an edited member still has
 * all seven (stale) ones, so the regeneration was simply dropped: the row saved,
 * the plan kept the old meals, and the wizard sent her to /plan as though it had
 * worked. That is the exact failure `memberEditIsSubstantive` was written to
 * prevent — «adding a nut allergy to a child saved the row and left the
 * nut-containing plan on screen» — reachable again through a busy window, and
 * the drain fires on every /plan and /dashboard visit, so busy is common.
 *
 * `updated_at` vs the plan's `generated_at` needs no new column and no marker:
 * regenerating clears it by construction, since the new plan is then the newer
 * of the two. A null `generated_at` means the plan has never finished building,
 * so the run in flight will cover it — nothing to chase.
 *
 * Cost of being approximate: an edit made DURING a live run that turns out to be
 * cosmetic (a rename) buys one extra regeneration. That is a rare, bounded
 * price for never leaving an allergy edit unapplied.
 */
export function staleMemberIds(
  members: Array<{ id: string; role: string; updated_at?: string | null }>,
  planGeneratedAt: string | null | undefined,
): string[] {
  if (!planGeneratedAt) return [];
  const builtMs = Date.parse(planGeneratedAt);
  if (!Number.isFinite(builtMs)) return [];
  return members
    .filter((m) => {
      if (m.role === "housekeeper") return false; // never a beneficiary
      if (!m.updated_at) return false;
      const editedMs = Date.parse(m.updated_at);
      return Number.isFinite(editedMs) && editedMs > builtMs;
    })
    .map((m) => m.id);
}
