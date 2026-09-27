import { redirect } from "next/navigation";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { isLocaleCode } from "@/lib/plans/locales";
import { BackButton } from "@/components/BackButton";
import { asStringArray } from "../labels";
import { FamilyPreferencesEditForm } from "./FamilyPreferencesEditForm";

export const metadata = {
  title: "تفضيلات العائلة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function FamilyPreferencesEditPage() {
  // Fetched together — the redirect guard below only needs profile.
  const [profile, members] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserFamilyMembers(),
  ]);
  if (!profile) redirect("/onboarding");
  const hk = members.find((m) => m.role === "housekeeper");
  const housekeeper =
    hk && isLocaleCode(hk.preferred_language)
      ? { id: hk.id, locale: hk.preferred_language }
      : hk
        ? { id: hk.id, locale: "ar" as const }
        : null;

  return (
    <main className="min-h-screen bg-brand-surface">
      <div className="container-app pt-3 -mb-4 md:-mb-6">
        <BackButton className="-ms-2.5" href="/profile" />
      </div>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <FamilyPreferencesEditForm
          initial={{
            cuisine_preference: profile.cuisine_preference || "",
            // 'halal' is implicit (always-on) — hide it from the editable list.
            family_dietary_restrictions: asStringArray(
              profile.family_dietary_restrictions,
            ).filter((d) => d !== "halal"),
            family_dislikes: asStringArray(profile.family_dislikes),
            cooking_methods: asStringArray(profile.cooking_methods),
            meal_out_frequency: profile.meal_out_frequency || "",
          }}
          housekeeper={housekeeper}
          ownerSex={profile.sex}
        />
      </div>
    </main>
  );
}
