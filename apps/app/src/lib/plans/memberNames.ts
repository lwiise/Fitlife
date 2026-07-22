import type { MealPlan, WorkoutPlan } from "@fitlife/plan-engine";

/**
 * The CURRENT roster names to overlay, keyed exactly as plan_data keys members:
 * "mom" is the account owner (profiles.display_name); every other member is a
 * family_members row (its id + current name).
 */
export interface MemberNameRoster {
  mom: { display_name?: string | null };
  members: Array<{ id: string; name?: string | null }>;
}

/**
 * A plan member as far as NAME display is concerned. Meal members also carry the
 * housekeeper-view transliteration pair; workout members don't (the housekeeper
 * is never a workout beneficiary) — hence the optional fields, so the one overlay
 * serves both MealPlan and WorkoutPlan.
 */
type NamedPlanMember = {
  member_id: string;
  member_name_ar: string;
  member_name_translated?: string;
  member_name_translated_locale?: string;
};

/**
 * Read-time member-name overlay — the naming sibling of applyChildDisplayTargets.
 *
 * A plan's plan_data freezes each member's NAME as of generation: the engine
 * stamps member_name_ar from profiles.display_name for "mom" and from
 * family_members.name for everyone else (buildContext.getBeneficiaries), and
 * never re-reads the roster afterwards. Renaming a member in Settings updates
 * ONLY the live roster row — the rename paths deliberately do not regenerate or
 * rewrite the snapshot (a name-only edit is treated as non-substantive) — so the
 * plan tabs, meal cards, PDF, workout viewer and history keep showing the OLD
 * name. This re-labels every member from the CURRENT roster at read time, so a
 * rename is reflected everywhere immediately, without a regenerate.
 *
 * When a member's Arabic name changed we also drop the stored
 * member_name_translated: it is a per-locale TRANSLITERATION of the OLD name
 * (systemPrompt: "نقل صوتي، وليس ترجمة معناه"), not a copy of the Arabic and not
 * re-derivable here without the model. Clearing it makes the translated
 * (housekeeper) view fall back to the live Arabic name — a proper noun, legible
 * cross-script — via PlanViewer's `member_name_translated ?? member_name_ar`,
 * until the next translation pass rebuilds the transliteration, rather than
 * showing the wrong old one.
 *
 * Members absent from the roster (e.g. a since-removed member still present in an
 * old plan) keep their snapshot name. Idempotent: when every name already
 * matches, the SAME object is returned by reference (mirrors applyChildDisplayTargets).
 */
export function applyMemberDisplayNames<P extends MealPlan | WorkoutPlan>(
  plan: P,
  roster: MemberNameRoster,
): P {
  const nameById = new Map<string, string>();
  const momName = roster.mom.display_name?.trim();
  if (momName) nameById.set("mom", momName);
  for (const m of roster.members) {
    const n = m.name?.trim();
    if (n) nameById.set(m.id, n);
  }

  let changed = false;
  const members = (plan.members as NamedPlanMember[]).map((m) => {
    const live = nameById.get(m.member_id);
    if (!live || live === m.member_name_ar) return m;
    changed = true;
    const next: NamedPlanMember = { ...m, member_name_ar: live };
    // Only meal members carry a transliteration; drop the now-stale one so the
    // housekeeper view falls back to the live Arabic name (see the doc comment).
    if (m.member_name_translated !== undefined) {
      next.member_name_translated = undefined;
      next.member_name_translated_locale = undefined;
    }
    return next;
  });

  return changed ? ({ ...plan, members } as P) : plan;
}
