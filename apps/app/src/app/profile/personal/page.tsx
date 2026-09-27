import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { PersonalEditForm } from "./PersonalEditForm";

export const metadata = {
  title: "المعلومات الشخصية — فت لايف",
  robots: { index: false, follow: false },
};

export default async function PersonalEditPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl">
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
