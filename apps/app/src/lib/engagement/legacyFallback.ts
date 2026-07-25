/**
 * Is a failed engagement write the pre-00019 schema (no `member_id` column),
 * or a real failure?
 *
 * The legacy fallbacks in `engagement/actions.ts` are deliberately WIDER than
 * the writes they stand in for: the delete drops every member's mark for the
 * meal, and the upsert writes a `'household'` row, which is the read-time
 * fallback for every member of that slot. On a database with no member
 * dimension that is exactly right. On any other error it is data loss — a
 * transient failure would clear marks the user never touched, or answer for
 * members who never marked.
 *
 * So the fallbacks are gated on this predicate rather than on "the write
 * failed". 42703 is Postgres' undefined_column; the message check covers
 * PostgREST shapes that surface the column name without that code.
 *
 * Lives outside actions.ts because that module is "use server" — every export
 * there has to be an async server action, so a pure predicate can't live in it
 * and still be unit-tested.
 */
export function isMissingMemberIdColumn(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  if (error.code === "42703") return true;
  return /member_id/i.test(error.message ?? "");
}
