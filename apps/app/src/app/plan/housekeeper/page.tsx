import { redirect } from "next/navigation";
import {
  getCurrentUserLatestPlan,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { isLocaleCode } from "@/lib/plans/locales";
import { HousekeeperPlanView } from "./HousekeeperPlanView";

export const metadata = {
  title: "وصفات الخدامة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function HousekeeperPage() {
  const [latest, familyMembers] = await Promise.all([
    getCurrentUserLatestPlan(),
    getCurrentUserFamilyMembers(),
  ]);

  // Need a ready plan with data.
  if (!latest || latest.status !== "ready" || !latest.plan_data) redirect("/plan");

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

  return (
    <HousekeeperPlanView
      plan={latest.plan_data}
      planId={latest.id}
      locale={locale}
      needsTranslation={needsTranslation}
    />
  );
}
