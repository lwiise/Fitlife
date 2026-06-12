import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { Logo } from "@/components/Logo";
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
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <BackButton href="/profile" />
        </div>
      </header>

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
