import { redirect } from "next/navigation";
import {
  getCurrentUserLatestPlan,
  getCurrentUserFamilyMembers,
  getCurrentUserProfile,
} from "@/lib/supabase/queries";
import { planHasContent } from "@fitlife/plan-engine";
import { isLocaleCode } from "@/lib/plans/locales";
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

  // Need a ready plan with data AND actual meals (a 'ready' shell with empty days
  // isn't cookable yet — send her back to /plan, which shows the loading state).
  if (
    !latest ||
    latest.status !== "ready" ||
    !latest.plan_data ||
    !planHasContent(latest.plan_data)
  ) {
    redirect("/plan");
  }

  // Need a housekeeper.
  const housekeeper = familyMembers.find((m) => m.role === "housekeeper");
  if (!housekeeper) redirect("/family");

  // Need a non-Arabic language (otherwise the Arabic /plan view already serves her).
  const locale = housekeeper.preferred_language;
  if (!isLocaleCode(locale) || locale === "ar") redirect("/plan");

  // Any meal not yet translated to her locale → the view self-heals (trigger +
  // poll). The locale stamp is set whenever recipe/ingredients/steps translate.
  const needsTranslation = latest.plan_data.members.some((m) =>
    m.days.some((d) =>
      d.meals.some((meal) => meal.prep_steps_translated_locale !== locale),
    ),
  );

  // Allergy backstop: sourced DIRECTLY from the DB (profiles + family_members),
  // never from recipe prose or plan_data. Mom first, then members in display order.
  const allergyEntries: AllergyEntry[] = [
    ...(profile
      ? [{ name: profile.display_name ?? "", allergies: asStringArray(profile.allergies) }]
      : []),
    ...familyMembers.map((m) => ({
      name: m.name,
      allergies: asStringArray(m.allergies),
    })),
  ].filter((e) => e.allergies.length > 0);

  return (
    <HousekeeperPlanView
      plan={latest.plan_data}
      planId={latest.id}
      locale={locale}
      needsTranslation={needsTranslation}
      allergyEntries={allergyEntries}
    />
  );
}
