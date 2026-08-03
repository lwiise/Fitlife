import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/plans/dayMapping";
import { isISODate } from "@/lib/engagement/seasonMath";
import {
  getCurrentUserCookablePlan,
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
  const [cookable, familyMembers, profile] = await Promise.all([
    getCurrentUserCookablePlan(),
    getCurrentUserFamilyMembers(),
    getCurrentUserProfile(),
  ]);

  // No plan at all → there's nothing for her page yet; /plan owns the empty state.
  if (!cookable) redirect("/plan");
  // A regeneration inserts an EMPTY plan row that supersedes her translated
  // week, so without this she loses tonight's dinner for the whole run — with no
  // Arabic view and no readable history to fall back on. `superseded` means she
  // is looking at the previous week while a new one is being built.
  const { plan: latest, superseded } = cookable;

  // Need a housekeeper.
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  if (!housekeeper) redirect("/family");

  // Need a non-Arabic language (otherwise the Arabic /plan view already serves her).
  const locale = housekeeper.preferred_language;
  if (!isLocaleCode(locale) || locale === "ar") redirect("/plan");

  // Whether anyone in the household is still queued or missing a day. This used
  // to force her waiting state, which meant the person who does the COOKING was
  // the last one in the house to see anything: four members could have complete,
  // translated weeks and she would still be looking at a spinner, because a
  // fifth had not been generated. It is now a NOTICE above a usable plan.
  const familyMemberIds = familyMembers
    .filter((m) => m.role !== "housekeeper")
    .map((m) => m.id);
  const partialWeek =
    !!latest.plan_data &&
    hasPendingGeneration({
      plan: latest.plan_data,
      familyMemberIds,
      maxAttempts: MEMBER_GEN_MAX_ATTEMPTS,
    });

  // Nothing cookable exists yet — the row is still generating, or it is a 'ready'
  // shell with no meals in it. Do NOT bounce her to the Arabic /plan view; that
  // is the "appears → disappears → comes back" flicker. Keep her on her own page
  // in a localized waiting state, and let the poll resolve it.
  const preparing =
    latest.status !== "ready" ||
    !latest.plan_data ||
    !planHasContent(latest.plan_data);

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

  // Shared-meal absences (00021). The cook is the one who has to get the
  // QUANTITY right, and her view rendered the stored batch unscaled: mom marks
  // سعود out of tonight's dinner, /plan shows the adjusted amounts, and the
  // kitchen still cooks for five. Read calendar-keyed exactly like /plan does —
  // every dispatch mints a new meal_plans row, so a plan-id read goes empty
  // mid-week — and degrade to [] on a pre-apply prod or any error, which just
  // restores the previous (unscaled) behaviour.
  const absences = await (async (): Promise<
    Array<{ day_index: number; slot: string; member_id: string }>
  > => {
    if (!latest.plan_data) return [];
    try {
      const supabase = (await createClient()) as unknown as SupabaseClient;
      const anchor = isISODate(latest.plan_data.week_start_date)
        ? latest.plan_data.week_start_date
        : null;
      const base = supabase.from("meal_absences").select("*");
      const { data } = await (anchor
        ? base
            .eq("user_id", profile?.id ?? "")
            .gte("local_date", anchor)
            .lte("local_date", addDaysISO(anchor, 6))
        : base.eq("meal_plan_id", latest.id)
      ).limit(400);
      return ((data ?? []) as Array<Record<string, unknown>>)
        .map((r) => ({
          day_index: Number(r.day_index),
          slot: String(r.slot),
          member_id: String(r.member_id),
        }))
        .filter((r) => Number.isFinite(r.day_index));
    } catch {
      return [];
    }
  })();

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

  // Allergy backstop: allergens sourced DIRECTLY from the DB (profiles +
  // family_members), never from recipe prose or plan_data. The member NAME is
  // joined to the plan's transliterated form (member_id "mom" for the owner,
  // family_members.id otherwise) so a non-Arabic cook can read whose line it is;
  // it falls back to the Arabic name until translation lands. Read from the
  // OVERLAID plan so a renamed member's stale transliteration is dropped here
  // too — otherwise the allergy line would show the old name while the plan tabs
  // below show the new one. Mom first, then members in display order. The
  // housekeeper is the cook, not a beneficiary — she's excluded (and never
  // appears in plan_data.members anyway).
  const nameByMember = new Map(
    (planForView?.members ?? []).map((m) => [
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

  return (
    <HousekeeperPlanView
      plan={planForView}
      planId={latest.id}
      locale={locale}
      needsTranslation={needsTranslation}
      preparing={preparing}
      partialWeek={partialWeek}
      superseded={superseded}
      absences={absences}
      allergyEntries={allergyEntries}
    />
  );
}
