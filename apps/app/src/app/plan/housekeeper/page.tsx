import { redirect } from "next/navigation";
import {
  getCurrentUserLatestPlan,
  getCurrentUserFamilyMembers,
  getCurrentUserProfile,
} from "@/lib/supabase/queries";
import {
  planHasContent,
  hasPendingGeneration,
  MEMBER_GEN_MAX_ATTEMPTS,
} from "@fitlife/plan-engine";
import { isLocaleCode } from "@/lib/plans/locales";
import { applyMemberDisplayNames } from "@/lib/plans/memberNames";
import { asStringArray } from "@/app/profile/labels";
import { HousekeeperPlanView } from "./HousekeeperPlanView";
import type { AllergyEntry } from "./AllergyBackstop";

export const metadata = {
  title: "وصفات الخدامة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HousekeeperPage() {
  const [latest, familyMembers, profile] = await Promise.all([
    getCurrentUserLatestPlan(),
    getCurrentUserFamilyMembers(),
    getCurrentUserProfile(),
  ]);

  // No plan at all → there's nothing for her page yet; /plan owns the empty state.
  if (!latest) redirect("/plan");

  // Need a housekeeper.
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  if (!housekeeper) redirect("/family");

  // Need a non-Arabic language (otherwise the Arabic /plan view already serves her).
  const locale = housekeeper.preferred_language;
  if (!isLocaleCode(locale) || locale === "ar") redirect("/plan");

  // The family plan is "fully uploaded" only when EVERY member is fully generated
  // (day 1 → last day) and none is still absent/queued. Until then keep her on the
  // waiting state rather than translate/show a partial plan (a member still
  // mid-generation, or a newly-added member, must finish completely first).
  const familyMemberIds = familyMembers
    .filter((m) => m.role !== "housekeeper")
    .map((m) => m.id);
  const stillGenerating =
    !!latest.plan_data &&
    hasPendingGeneration({
      plan: latest.plan_data,
      familyMemberIds,
      maxAttempts: MEMBER_GEN_MAX_ATTEMPTS,
    });

  // A plan exists but isn't ready+cookable yet (status still generating, a
  // 'ready' shell with empty days while a member's generation is in flight, or a
  // member still queued to be generated). Do NOT bounce her to the Arabic /plan
  // view — that's the "appears → disappears → comes back" flicker. Keep her on her
  // own page in a localized waiting state; the poll resolves it once the plan is
  // fully generated and translated.
  const preparing =
    latest.status !== "ready" ||
    !latest.plan_data ||
    !planHasContent(latest.plan_data) ||
    stillGenerating;

  // Any meal not yet translated to her locale → the view self-heals (trigger +
  // poll). The locale stamp is set whenever recipe/ingredients/steps translate.
  const needsTranslation =
    !preparing &&
    !!latest.plan_data &&
    latest.plan_data.members.some((m) =>
      m.days.some((d) =>
        d.meals.some((meal) => meal.prep_steps_translated_locale !== locale),
      ),
    );

  // Allergy backstop: allergens sourced DIRECTLY from the DB (profiles +
  // family_members), never from recipe prose or plan_data. The member NAME is
  // joined to the plan's transliterated form (member_id "mom" for the owner,
  // family_members.id otherwise) so a non-Arabic cook can read whose line it is;
  // it falls back to the Arabic name until translation lands. Mom first, then
  // members in display order. The housekeeper is the cook, not a beneficiary —
  // she's excluded (and never appears in plan_data.members anyway).
  const nameByMember = new Map(
    (latest.plan_data?.members ?? []).map((m) => [
      m.member_id,
      m.member_name_translated,
    ]),
  );
  const allergyEntries: AllergyEntry[] = [
    ...(profile
      ? [
          {
            name: profile.display_name ?? "",
            nameTranslated: nameByMember.get("mom"),
            allergies: asStringArray(profile.allergies),
          },
        ]
      : []),
    ...familyMembers
      .filter((m) => m.role !== "housekeeper")
      .map((m) => ({
        name: m.name,
        nameTranslated: nameByMember.get(m.id),
        allergies: asStringArray(m.allergies),
      })),
  ].filter((e) => e.allergies.length > 0);

  // Overlay live-roster names so a rename shows immediately. When a member's
  // Arabic name changed this drops the stale transliteration, so the maid view
  // falls back to the live Arabic name until the next translation pass rebuilds
  // it (PlanViewer's `member_name_translated ?? member_name_ar`).
  const planForView = latest.plan_data
    ? applyMemberDisplayNames(latest.plan_data, {
        mom: { display_name: profile?.display_name ?? null },
        members: familyMembers,
      })
    : null;

  return (
    <HousekeeperPlanView
      plan={planForView}
      planId={latest.id}
      locale={locale}
      needsTranslation={needsTranslation}
      preparing={preparing}
      allergyEntries={allergyEntries}
    />
  );
}
