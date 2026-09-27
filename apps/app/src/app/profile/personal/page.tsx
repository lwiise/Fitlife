import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { BackButton } from "@/components/BackButton";
import { PersonalEditForm } from "./PersonalEditForm";

export const metadata = {
  title: "المعلومات الشخصية — فت لايف",
  robots: { index: false, follow: false },
};

export default async function PersonalEditPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-brand-surface">
      <div className="container-app pt-3 -mb-4 md:-mb-6">
        <BackButton className="-ms-2.5" href="/profile" />
      </div>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <PersonalEditForm
          initial={{
            display_name: profile.display_name ?? "",
            birth_year: profile.birth_year ?? undefined,
            sex: profile.sex === "male" ? "male" : "female",
            height_cm: profile.height_cm ?? undefined,
            weight_kg: profile.weight_kg ?? undefined,
          }}
        />
      </div>
    </main>
  );
}
