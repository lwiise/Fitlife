/**
 * The one status line under each person in the /plan member sheet («أفراد
 * البيت», 09/2026). One line, so one answer — the most urgent true thing:
 *
 *   translation (the cook's view) › being prepared › the open day came before
 *   they joined the plan › the open day not ready › the plan's figure
 *   (calories, or «بالحصص» for a child)
 *
 * Pure so the priority is pinned by a test rather than by the order of a JSX
 * ternary nobody re-reads.
 */
export type MemberSheetStatus =
  | "translating"
  | "queued"
  | "generating"
  | "before_join"
  | "day_empty"
  | "portions"
  | "calories";

export function memberSheetStatus(input: {
  memberId: string;
  /** The cook's view only; "done" everywhere else. */
  translation: "done" | "translating" | "queued";
  /** A generation run is live and has not stalled. */
  generating: boolean;
  /** plan.generating_member_id — the run's one member, when it stamped one. */
  generatingMemberId?: string | null;
  /** Every day of this member's week already has meals — from the day they
   * joined, for someone added mid-week (memberIsShort). */
  weekComplete: boolean;
  /** The day open in the strip came before this member joined the plan: it is
   * empty on purpose, so it must never read as «not ready yet». */
  beforeJoin?: boolean;
  /** The day open in the strip has meals for this member. */
  dayHasMeals: boolean;
  /** Planned by portions — only on the Arabic view, which has the words. */
  isChild: boolean;
}): MemberSheetStatus {
  if (input.translation === "translating") return "translating";
  if (input.translation === "queued") return "queued";
  // A run without a stamped member fills every incomplete member; a member
  // whose week is already whole is not being prepared, whatever the flag says.
  const beingPrepared =
    input.generating &&
    !input.weekComplete &&
    (input.generatingMemberId == null || input.generatingMemberId === input.memberId);
  if (beingPrepared) return "generating";
  if (input.beforeJoin) return "before_join";
  if (!input.dayHasMeals) return "day_empty";
  return input.isChild ? "portions" : "calories";
}
