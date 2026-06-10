import { redirect } from "next/navigation";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { isLocaleCode } from "@/lib/plans/locales";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { asStringArray } from "../labels";
import { FamilyPreferencesEditForm } from "./FamilyPreferencesEditForm";

export const metadata = {
  title: "تفضيلات العائلة — فت لايف",
  robots: { index: false, follow: false },
};

export default async function FamilyPreferencesEditPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  const members = await getCurrentUserFamilyMembers();
  const hk = members.find((m) => m.role === "housekeeper");
  const housekeeper =
    hk && isLocaleCode(hk.preferred_language)
      ? { id: hk.id, locale: hk.preferred_language }
      : hk
        ? { id: hk.id, locale: "ar" as const }
        : null;

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <BackButton />
        </div>
      </header>

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
        />
      </div>
    </main>
  );
}
